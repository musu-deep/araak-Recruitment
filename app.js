(() => {
  'use strict';

  const CONFIG = Object.assign({
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    STORAGE_BUCKET: 'employment-attachments',
    PROCESS_FUNCTION: 'process-recruitment-submission',
    PARSE_FUNCTION: 'parse-cv'
  }, window.__ARAAK_RUNTIME_CONFIG__ || {});

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const normalizeDigits = (value) => String(value || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

  const STORE = 'araak-recruitment-draft-v4';
  const steps = [
    ['بيانات الوظيفة','الوظيفة والمدن المفضلة'],
    ['البيانات الشخصية','الهوية والتواصل والسكن'],
    ['المعالون','من تعتمد معيشتهم عليك مالياً'],
    ['الخبرات العملية','سجل الخبرات السابقة'],
    ['الجاهزية والمعلومات','أسئلة الجاهزية والمعلومات النظامية'],
    ['التعليم والتدريب','المؤهلات والدورات'],
    ['اللغات والمهارات','لغاتك ومهاراتك وهواياتك'],
    ['المعرفون','المعرفون والمعلومات الإضافية'],
    ['المرفقات','السيرة والشهادات والوثائق'],
    ['طلب مقابلة','اقتراح موعد مقابلة أو اجتماع'],
    ['الإقرار والإرسال','مراجعة البيانات والتوقيع']
  ];

  let step = 0;
  let files = [];
  let draft = loadDraft();

  function blankDraft(){
    return {
      data: {},
      repeat: {dependents:[], experience:[], education:[], training:[], languages:[], skills:[], references:[]},
      meta: {}
    };
  }

  function loadDraft(){
    const base = blankDraft();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
      return {
        data: Object.assign({}, base.data, saved.data || {}),
        repeat: Object.assign({}, base.repeat, saved.repeat || {}),
        meta: Object.assign({}, base.meta, saved.meta || {})
      };
    } catch {
      return base;
    }
  }

  function value(name){ return draft.data[name] ?? ''; }

  function saveDraft(showToast = false){
    draft.meta.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORE, JSON.stringify(draft)); } catch {}
    const state = $('#saveState');
    if (state) {
      state.textContent = 'تم الحفظ الآن';
      setTimeout(() => { if (state) state.textContent = 'حفظ تلقائي'; }, 900);
    }
    if (showToast) toast('تم حفظ المسودة على هذا الجهاز');
  }

  function toast(message){
    const box = $('#toast');
    if (!box) return;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => box.classList.remove('show'), 2800);
  }

  function optionList(items, selected = ''){
    return items.map(item => `<option value="${esc(item)}" ${item === selected ? 'selected' : ''}>${esc(item)}</option>`).join('');
  }

  function field(label, name, type = 'text', options = {}){
    const required = options.required ? '<span class="req"> *</span>' : '';
    const common = `${options.required ? 'required' : ''}`;
    const val = esc(value(name));
    const cls = options.class || '';
    if (type === 'textarea') {
      return `<div class="field ${cls}"><label>${label}${required}</label><textarea name="${name}" ${common} placeholder="${esc(options.placeholder || '')}">${val}</textarea></div>`;
    }
    if (type === 'select') {
      return `<div class="field ${cls}"><label>${label}${required}</label><select name="${name}" ${common}><option value="">اختر</option>${optionList(options.items || [], value(name))}</select></div>`;
    }
    return `<div class="field ${cls}"><label>${label}${required}</label><input name="${name}" type="${type}" value="${val}" ${common} placeholder="${esc(options.placeholder || '')}"></div>`;
  }

  function radios(label, name, items, cls = ''){
    return `<div class="field ${cls}"><label>${label}</label><div class="choices">${items.map(([v,l]) => `<label class="choice"><input type="radio" name="${name}" value="${esc(v)}" ${value(name) === v ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>`;
  }

  function panel(title, subtitle, content, action = ''){
    return `<section class="panel"><div class="panel-head"><div><h3>${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</div>${content}</section>`;
  }

  const addButton = (type, label) => `<button type="button" class="add" data-add="${type}">＋ ${label}</button>`;

  function repeatLabel(type){
    return {dependents:'مُعال',experience:'خبرة',education:'مؤهل',training:'دورة',languages:'لغة',skills:'مهارة',references:'مُعرّف'}[type] || 'عنصر';
  }

  function repeatField(type, item, key, label, inputType = 'text', cls = ''){
    return `<div class="field ${cls}"><label>${label}</label><input data-repeat="${type}" data-id="${item.id}" data-key="${key}" type="${inputType}" value="${esc(item[key] || '')}"></div>`;
  }

  function repeatTextarea(type, item, key, label, cls = ''){
    return `<div class="field ${cls}"><label>${label}</label><textarea data-repeat="${type}" data-id="${item.id}" data-key="${key}">${esc(item[key] || '')}</textarea></div>`;
  }

  function repeatSelect(type, item, key, label, items){
    return `<div class="field"><label>${label}</label><select data-repeat="${type}" data-id="${item.id}" data-key="${key}"><option value="">اختر</option>${optionList(items, item[key] || '')}</select></div>`;
  }

  function repeatCard(type, item, index){
    let body = '';
    if (type === 'dependents') body = `<div class="grid4">${repeatField(type,item,'name','اسم المُعال')}${repeatField(type,item,'age','العمر','number')}${repeatField(type,item,'relation','صلة القرابة')}${repeatField(type,item,'address','العنوان')}</div>`;
    if (type === 'experience') body = `<div class="grid4">${repeatField(type,item,'company','الجهة','text','span2')}${repeatField(type,item,'title','المسمى')}${repeatField(type,item,'city','المدينة / البلد')}${repeatField(type,item,'from','من','date')}${repeatField(type,item,'to','إلى','date')}${repeatField(type,item,'salary','الراتب','number')}${repeatField(type,item,'reason','سبب ترك العمل')}${repeatTextarea(type,item,'duties','أبرز المهام','span4')}</div>`;
    if (type === 'education') body = `<div class="grid4">${repeatField(type,item,'school','الجامعة / الجهة','text','span2')}${repeatField(type,item,'degree','الدرجة')}${repeatField(type,item,'major','التخصص')}${repeatField(type,item,'year','سنة التخرج','number')}${repeatField(type,item,'grade','التقدير')}</div>`;
    if (type === 'training') body = `<div class="grid3">${repeatField(type,item,'course','اسم الدورة','text','span2')}${repeatField(type,item,'provider','الجهة المقدمة')}${repeatField(type,item,'date','التاريخ','month')}</div>`;
    if (type === 'languages') body = `<div class="grid2">${repeatField(type,item,'name','اللغة')}${repeatSelect(type,item,'level','المستوى',['مبتدئ','متوسط','متقدم','طليق / لغة أم'])}</div>`;
    if (type === 'skills') body = `<div class="grid2">${repeatField(type,item,'name','المهارة')}${repeatSelect(type,item,'level','المستوى',['مبتدئ','متوسط','متقدم','خبير'])}</div>`;
    if (type === 'references') body = `<div class="grid4">${repeatField(type,item,'name','الاسم')}${repeatField(type,item,'position','الوظيفة')}${repeatField(type,item,'company','الجهة')}${repeatField(type,item,'tel','الهاتف','tel')}${repeatField(type,item,'address','العنوان','text','span4')}</div>`;
    return `<div class="repeat"><div class="repeat-head"><b>${repeatLabel(type)} ${index + 1}</b><button type="button" class="remove" data-remove="${type}" data-id="${item.id}">×</button></div>${body}</div>`;
  }

  function repeatList(type){
    const items = draft.repeat[type] || [];
    if (!items.length) return '<div class="empty">لا توجد بيانات مضافة حالياً.</div>';
    return items.map((item, i) => repeatCard(type, item, i)).join('');
  }

  const nationalities = ['سعودي','مصري','سوداني','يمني','أردني','فلسطيني','سوري','لبناني','عراقي','هندي','باكستاني','بنغلاديشي','فلبيني','إندونيسي','سريلانكي','نيبالي','مغربي','تونسي','جزائري','موريتاني','تركي','أخرى'];

  function renderStep(index){
    if (index === 0) return panel('الوظيفة المتقدم لها','Position Applied For',
      `<div class="grid2">${field('المسمى الوظيفي','position','text',{placeholder:'اختياري — اكتب المسمى إذا كان معروفاً'})}${field('القسم أو المجال','department','text',{placeholder:'اختياري'})}${field('المدينة المفضلة الأولى','city1','text',{required:true})}${field('المدينة المفضلة الثانية','city2')}${field('المدينة المفضلة الثالثة','city3')}${field('كيف عرفت عن فرصة العمل؟','jobSource','select',{items:['موقع الشركة','منصة توظيف','وسائل التواصل الاجتماعي','ترشيح','صديق أو معرفة','أخرى']})}</div><div class="notice">الحقول المعلّمة بنجمة حمراء (*) فقط إلزامية.</div>`);

    if (index === 1) return [
      panel('الاسم والبيانات الأساسية','Personal Information', `<div class="grid4">${field('الاسم الأول','firstName','text',{required:true})}${field('اسم الأب','fatherName','text',{required:true})}${field('اسم الجد','grandName')}${field('اسم العائلة','familyName','text',{required:true})}${field('تاريخ الميلاد','birthDate','date',{required:true})}${field('مكان الميلاد','birthPlace','text',{required:true})}${field('الجنسية','nationality','select',{required:true,items:nationalities})}${field('الجنس','gender','select',{items:['ذكر','أنثى']})}</div>`),
      panel('مكان الإقامة والهوية','Residence & Identity', `<div class="grid3">${field('مكان الإقامة الحالي','locationStatus','select',{required:true,items:['داخل المملكة','خارج المملكة']})}${field('رقم الهوية / الإقامة','idNo','text',{required:true})}${field('مكان إصدار الهوية / الإقامة','idIssuePlace')}${field('تاريخ الإصدار','idIssueDate','date')}${field('رقم الجواز','passportNo')}${field('مكان إصدار الجواز','passportIssuePlace')}${field('تاريخ إصدار الجواز','passportIssueDate','date')}${field('تاريخ انتهاء الجواز','passportExpiryDate','date')}</div><div class="notice" id="identityNote"></div>`),
      panel('التواصل والعنوان','Contact Information', `<div class="grid3">${field('رقم الجوال','mobile','tel',{required:true})}${field('البريد الإلكتروني','email','email',{required:true})}${field('هاتف بديل','altPhone','tel')}${field('العنوان الحالي','presentAddress','text',{required:true,class:'span2'})}${field('الرمز البريدي','postCode')}</div><div class="grid2">${radios('الحالة الاجتماعية','marital',[['single','أعزب / عزباء'],['married','متزوج / متزوجة']])}${radios('هل تعول أشخاصاً تعتمد معيشتهم عليك مالياً؟','hasDependents',[['no','لا'],['yes','نعم']])}</div>`)
    ].join('');

    if (index === 2) return panel('بيانات المعالين','المقصود من تعتمد معيشتهم عليك مالياً، مثل الأبناء أو الوالدين أو غيرهم.', `<div class="repeat-list">${repeatList('dependents')}</div>`, addButton('dependents','إضافة مُعال'));

    if (index === 3) return panel('الحالة الوظيفية الحالية','Employment Status', `<div class="grid3">${radios('هل تعمل حالياً؟','employedNow',[['yes','نعم'],['no','لا']])}${field('متى تستطيع مباشرة العمل؟','startDate','date')}${field('مدة الإشعار الحالية','noticePeriod')}</div>`) + panel('الخبرات السابقة','Previous Employment', `<div class="repeat-list">${repeatList('experience')}</div>`, addButton('experience','إضافة خبرة أخرى'));

    if (index === 4) return panel('الجاهزية','Readiness', `<div class="grid3">${field('آخر ثلاث وظائف باختصار','lastThreeJobs','textarea',{class:'span3',placeholder:'الجهة — المسمى — المدة'})}${field('الراتب الحالي','currentSalary','number')}${field('الراتب المتوقع','expectedSalary','number')}${field('العملة','salaryCurrency','select',{items:['SAR','USD','EUR','EGP','SDG','أخرى']})}${radios('هل تقبل الانتقال لمدينة أخرى؟','relocation',[['yes','نعم'],['no','لا']])}</div>`) + panel('معلومات إضافية','Additional Information', `<div class="grid2">${field('رخصة القيادة / الفئة','drivingLicence')}${field('معلومات أخرى ذات صلة','otherInfo','textarea')}</div>`);

    if (index === 5) return panel('التحصيل العلمي','Education', `<div class="repeat-list">${repeatList('education')}</div>`, addButton('education','إضافة مؤهل آخر')) + panel('الدورات التدريبية','Training', `<div class="repeat-list">${repeatList('training')}</div>`, addButton('training','إضافة دورة'));

    if (index === 6) return panel('اللغات','Languages', `<div class="repeat-list">${repeatList('languages')}</div>`, addButton('languages','إضافة لغة')) + panel('المهارات','Skills', `<div class="repeat-list">${repeatList('skills')}</div>`, addButton('skills','إضافة مهارة')) + panel('الهوايات والاهتمامات','Hobbies', field('الهوايات والاهتمامات','hobbies','textarea',{placeholder:'اكتب بإيجاز'}));

    if (index === 7) return panel('المعرفون','أشخاص من غير الأقارب يمكن الرجوع إليهم مهنياً.', `<div class="repeat-list">${repeatList('references')}</div>`, addButton('references','إضافة مُعرّف')) + panel('معلومات إضافية','Other', field('ملاحظات إضافية','otherData','textarea'));

    if (index === 8) return panel('المرفقات والـ CV','Attachments & AI Parsing', `<div class="notice"><b>تعبئة ذكية:</b> ارفع السيرة الذاتية ثم اضغط استخلاص البيانات. راجع المعلومات قبل الإرسال.</div><div class="grid2" style="margin-top:14px"><div class="field"><label>السيرة الذاتية للتعبئة الذكية</label><input id="smartCv" type="file" accept=".pdf,.doc,.docx"></div><div class="field" style="align-content:end"><button class="secondary" type="button" id="parseCv">استخلاص البيانات من السيرة</button></div></div><div class="upload"><b>إرفاق السيرة والشهادات والوثائق الداعمة</b><p>PDF، JPG، PNG، DOC، DOCX — حتى 10MB للملف</p><button class="secondary" id="browse" type="button">اختيار الملفات</button><input id="fileInput" class="hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"></div><div class="files" id="files"></div>`);

    if (index === 9) return panel('طلب مقابلة أو اجتماع','يمكنك اقتراح موعد؛ لا يصبح الموعد مؤكداً إلا بعد اعتماده من الموارد البشرية.', `<div class="grid3">${radios('هل ترغب باقتراح موعد؟','requestMeeting',[['no','لا، أرسل الطلب فقط'],['yes','نعم']],'span3')}${field('التاريخ المفضل','meetingDate','date')}${field('الوقت المفضل','meetingTime','time')}${field('طريقة المقابلة','meetingMode','select',{items:['مقابلة عبر الإنترنت','اتصال هاتفي','حضورياً']})}${field('ملاحظات الموعد','meetingNotes','textarea',{class:'span3'})}</div>`);

    const fullName = [value('firstName'), value('fatherName'), value('grandName'), value('familyName')].filter(Boolean).join(' ');
    return panel('مراجعة سريعة','راجع البيانات الأساسية.', `<div class="review"><div><span>المتقدم</span><b>${esc(fullName || '—')}</b></div><div><span>الوظيفة</span><b>${esc(value('position') || 'طلب توظيف عام')}</b></div><div><span>الجوال</span><b>${esc(value('mobile') || '—')}</b></div><div><span>البريد</span><b>${esc(value('email') || '—')}</b></div><div><span>المرفقات</span><b>${files.length}</b></div><div><span>المقابلة</span><b>${value('requestMeeting') === 'yes' ? 'مطلوبة' : 'غير مطلوبة'}</b></div></div>`) + panel('الإقرار والتوقيع','Declaration & Signature', `<div class="notice">أقر بأن جميع البيانات والمستندات المقدمة صحيحة وكاملة حسب علمي، وأفوض مجموعة اراك وشركاتها بالتحقق منها للأغراض النظامية والمهنية المتعلقة بالتوظيف. وأعلم أن تقديم بيانات جوهرية غير صحيحة أو إغفال معلومات مؤثرة قد يترتب عليه استبعاد الطلب أو إلغاء أي إجراء وظيفي مبني عليه، وفق الأنظمة والسياسات المعمول بها.</div><div class="grid2" style="margin-top:14px">${field('الاسم المعتمد كتوقيع إلكتروني','signatureName','text',{required:true,placeholder:fullName})}${field('تاريخ الإقرار','declarationDate','date',{required:true})}</div><div class="signature"><b>التوقيع الإلكتروني</b><div class="signature-preview" id="signaturePreview">${esc(value('signatureName') || fullName || 'التوقيع')}</div></div><label class="choice" style="margin-top:13px"><input type="checkbox" name="declarationAgree" ${value('declarationAgree') ? 'checked' : ''}> أوافق على الإقرار واستخدام البيانات لأغراض التوظيف</label>`) + `<section class="panel submit"><div class="submit-icon">✓</div><h3>طلبك جاهز للإرسال</h3><p>سيتم حفظ الطلب والمرفقات في قاعدة بيانات التوظيف وإحالته للمراجعة.</p><button id="submit" class="primary" type="button">إرسال طلب التوظيف</button></section>`;
  }

  function updateIdentityRules(){
    const status = $('[name="locationStatus"]')?.value || value('locationStatus');
    const passport = $('[name="passportNo"]');
    const note = $('#identityNote');
    if (passport) passport.required = status === 'خارج المملكة';
    if (note) note.textContent = status === 'خارج المملكة'
      ? 'خارج المملكة: رقم الهوية/الوثيقة ورقم الجواز إلزاميان لاستكمال الطلب.'
      : 'داخل المملكة: رقم الهوية/الإقامة إلزامي، بينما رقم الجواز اختياري.';
  }

  function progress(){
    const required = ['city1','firstName','fatherName','familyName','birthDate','birthPlace','nationality','locationStatus','idNo','mobile','email','presentAddress','signatureName','declarationDate'];
    const count = required.filter(k => String(value(k)).trim()).length;
    let pct = Math.round(count / required.length * 88) + (files.length ? 6 : 0) + (value('declarationAgree') ? 6 : 0);
    pct = Math.min(100, pct);
    const pctEl = $('#pct');
    const bar = $('#bar');
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (bar) bar.style.width = `${pct}%`;
  }

  function updateHead(){
    $('#kicker').textContent = `القسم ${step + 1} من ${steps.length}`;
    $('#stageTitle').textContent = steps[step][0];
    $('#stageDesc').textContent = steps[step][1];
    $('#prev').disabled = step === 0;
    $('#next').textContent = step === steps.length - 1 ? 'مراجعة البيانات' : 'التالي ←';
  }

  function renderNav(){
    const nav = $('#steps');
    nav.innerHTML = steps.map((item, i) => `<button type="button" class="step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}" data-jump="${i}"><span class="num">${i+1}</span><b>${item[0]}</b><span class="tick">✓</span></button>`).join('');
    $$('[data-jump]', nav).forEach(button => button.addEventListener('click', () => {
      step = Number(button.dataset.jump);
      build();
      window.scrollTo({top:0, behavior:'smooth'});
    }));
  }

  function validateCurrent(){
    let ok = true;
    $$('#mount [required]').forEach(el => {
      const empty = !String(el.value || '').trim();
      el.style.borderColor = empty ? 'var(--danger)' : '';
      if (empty) ok = false;
    });
    if (!ok) toast('يرجى استكمال الحقول الإلزامية المعلّمة بالنجمة');
    return ok;
  }

  function bindStep(){
    $$('#mount [name]').forEach(el => {
      const update = () => {
        draft.data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
        if (el.name === 'signatureName' && $('#signaturePreview')) $('#signaturePreview').textContent = el.value || 'التوقيع';
        if (el.name === 'locationStatus') updateIdentityRules();
        saveDraft();
        progress();
      };
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });

    $$('[data-repeat]').forEach(el => el.addEventListener('input', () => {
      const arr = draft.repeat[el.dataset.repeat] || [];
      const item = arr.find(x => x.id === el.dataset.id);
      if (item) {
        item[el.dataset.key] = el.value;
        saveDraft();
      }
    }));

    $$('[data-add]').forEach(button => button.addEventListener('click', () => {
      (draft.repeat[button.dataset.add] ||= []).push({id:uid()});
      saveDraft();
      build();
    }));

    $$('[data-remove]').forEach(button => button.addEventListener('click', () => {
      draft.repeat[button.dataset.remove] = (draft.repeat[button.dataset.remove] || []).filter(x => x.id !== button.dataset.id);
      saveDraft();
      build();
    }));

    const browse = $('#browse');
    if (browse) browse.addEventListener('click', () => $('#fileInput')?.click());
    const fileInput = $('#fileInput');
    if (fileInput) fileInput.addEventListener('change', event => addFiles(event.target.files));
    if ($('#files')) renderFiles();
    if ($('#parseCv')) $('#parseCv').addEventListener('click', parseCV);
    if ($('#submit')) $('#submit').addEventListener('click', submitApplication);
    updateIdentityRules();
  }

  function build(){
    const mount = $('#mount');
    mount.innerHTML = `<div class="form-step">${renderStep(step)}</div>`;
    bindStep();
    renderNav();
    updateHead();
    progress();
  }

  function addFiles(fileList){
    Array.from(fileList || []).forEach(file => {
      if (file.size > 10 * 1024 * 1024) return toast(`${file.name} أكبر من 10MB`);
      files.push({id:uid(), file, name:file.name, size:file.size, type:file.type});
    });
    renderFiles();
    progress();
  }

  function renderFiles(){
    const holder = $('#files');
    if (!holder) return;
    holder.innerHTML = files.map(file => `<div class="file-row"><span class="file-badge">${esc((file.name.split('.').pop() || 'FILE').toUpperCase())}</span><div><b>${esc(file.name)}</b><small>${(file.size/1024/1024).toFixed(2)} MB</small></div><button class="danger" type="button" data-file="${file.id}">حذف</button></div>`).join('');
    $$('[data-file]', holder).forEach(button => button.addEventListener('click', () => {
      files = files.filter(x => x.id !== button.dataset.file);
      renderFiles();
      progress();
    }));
  }

  function authHeaders(extra = {}){
    return Object.assign({apikey: CONFIG.SUPABASE_ANON_KEY, Authorization:`Bearer ${CONFIG.SUPABASE_ANON_KEY}`}, extra);
  }

  async function supabase(path, options = {}){
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) throw new Error('إعدادات Supabase غير مكتملة');
    const response = await fetch(CONFIG.SUPABASE_URL + path, Object.assign({}, options, {headers: authHeaders(options.headers || {})}));
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase ${response.status}: ${text}`);
    }
    return response;
  }

  const insert = (table, row) => supabase(`/rest/v1/${table}`, {method:'POST', headers:{'Content-Type':'application/json', Prefer:'return=minimal'}, body:JSON.stringify(row)});

  async function uploadFile(applicationId, item){
    const safeName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${applicationId}/${Date.now()}-${safeName}`;
    await supabase(`/storage/v1/object/${CONFIG.STORAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {method:'POST', headers:{'Content-Type':item.type || 'application/octet-stream'}, body:item.file});
    await insert('employment_attachments', {application_id:applicationId,file_name:item.name,file_path:path,file_type:item.type,file_size:item.size});
  }

  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function parseCV(){
    const file = $('#smartCv')?.files?.[0];
    if (!file) return toast('اختر ملف السيرة الذاتية أولاً');
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return toast('إعدادات Supabase غير مكتملة');
    const button = $('#parseCv');
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'جارٍ التحليل…';
    try {
      const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/${CONFIG.PARSE_FUNCTION}`, {
        method:'POST',
        headers:authHeaders({'Content-Type':'application/json'}),
        body:JSON.stringify({fileName:file.name,mimeType:file.type || 'application/pdf',base64:await fileToBase64(file)})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذر تحليل السيرة');
      const z = payload.fields || {};
      const map = {first_name:'firstName',father_name:'fatherName',grand_name:'grandName',family_name:'familyName',email:'email',mobile:'mobile',birth_date:'birthDate',birth_place:'birthPlace',nationality:'nationality',desired_position:'position',department:'department',current_address:'presentAddress',hobbies:'hobbies'};
      Object.entries(map).forEach(([from,to]) => { if (z[from]) draft.data[to] = z[from]; });
      (z.experiences || []).forEach(x => draft.repeat.experience.push({id:uid(),company:x.company||'',title:x.position||'',city:x.city_country||'',from:x.start_date||'',to:x.end_date||'',duties:x.responsibilities||''}));
      (z.education || []).forEach(x => draft.repeat.education.push({id:uid(),school:x.institution||'',degree:x.degree||'',major:x.major||'',year:x.graduation_year||'',grade:x.grade||''}));
      (z.training || []).forEach(x => draft.repeat.training.push({id:uid(),course:x.course_name||'',provider:x.provider||'',date:x.course_date||''}));
      (z.languages || []).forEach(x => draft.repeat.languages.push({id:uid(),name:x.language_name||'',level:x.level||''}));
      (z.skills || []).forEach(x => draft.repeat.skills.push({id:uid(),name:x.skill_name||'',level:x.level||''}));
      saveDraft();
      build();
      toast('تم استخلاص البيانات المتاحة من السيرة — راجعها قبل الإرسال');
    } catch (error) {
      console.error(error);
      toast(error.message || 'تعذر تحليل السيرة');
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  async function submitApplication(){
    if (!validateCurrent()) return;
    if (!value('declarationAgree')) return toast('يرجى الموافقة على الإقرار قبل الإرسال');
    if (value('locationStatus') === 'خارج المملكة' && !value('passportNo')) return toast('رقم الجواز إلزامي للمتقدم خارج المملكة');

    const button = $('#submit');
    button.disabled = true;
    button.textContent = 'جارٍ حفظ الطلب…';
    const id = uid();
    const token = uid() + uid();
    const applicantName = [value('firstName'),value('fatherName'),value('grandName'),value('familyName')].filter(Boolean).join(' ');
    const data = Object.assign({}, draft.data, {
      first_name:value('firstName'), father_name:value('fatherName'), grand_name:value('grandName'), family_name:value('familyName'),
      birth_date:value('birthDate'), birth_place:value('birthPlace'), nationality:value('nationality'), email:value('email'), mobile:value('mobile'),
      desired_position:value('position'), department:value('department'), current_address:value('presentAddress'),
      location_status:value('locationStatus') === 'داخل المملكة' ? 'inside' : 'outside', repeat:draft.repeat
    });

    try {
      await insert('employment_applications', {id,data,submission_token:token,status:'new',source:'web',applicant_name:applicantName,email:value('email'),mobile:value('mobile'),nationality:value('nationality'),desired_position:value('position') || null,integration_status:'pending'});
      for (const item of files) await uploadFile(id, item);
      if (value('requestMeeting') === 'yes') {
        await insert('meeting_requests', {id:uid(),application_id:id,preferred_date:value('meetingDate') || null,preferred_time:value('meetingTime') || null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,meeting_type:value('meetingMode') || 'remote',notes:value('meetingNotes') || null,status:'requested'});
      }
      if (CONFIG.PROCESS_FUNCTION) {
        try {
          await supabase(`/functions/v1/${CONFIG.PROCESS_FUNCTION}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({applicationId:id,submissionToken:token})});
        } catch (error) { console.warn('Post-processing failed', error); }
      }
      draft.meta.submissionId = id;
      saveDraft();
      $('#ref').textContent = id;
      $('#success').classList.remove('hidden');
    } catch (error) {
      console.error(error);
      toast('تعذر حفظ الطلب. تحقق من إعداد Supabase والجداول ثم حاول مرة أخرى.');
    } finally {
      button.disabled = false;
      button.textContent = 'إرسال طلب التوظيف';
    }
  }

  function startApplication(event){
    if (event) event.preventDefault();
    const nameInput = $('#entryName');
    const mobileInput = $('#entryMobile');
    const name = String(nameInput?.value || '').trim();
    const mobile = normalizeDigits(String(mobileInput?.value || '').trim());
    const digits = mobile.replace(/\D/g, '');

    if (name.length < 3) {
      nameInput?.focus();
      return toast('اكتب الاسم الكامل');
    }
    if (digits.length < 9 || digits.length > 15) {
      mobileInput?.focus();
      return toast('اكتب رقم جوال صحيح من 9 إلى 15 رقماً');
    }

    draft.data.entryName = name;
    draft.data.entryMobile = mobile;
    if (!value('mobile')) draft.data.mobile = mobile;
    const parts = name.split(/\s+/).filter(Boolean);
    if (!value('firstName')) draft.data.firstName = parts[0] || '';
    if (!value('familyName')) draft.data.familyName = parts.length > 1 ? parts[parts.length - 1] : '';
    if (!value('declarationDate')) draft.data.declarationDate = new Date().toISOString().slice(0,10);
    saveDraft();

    $('#hero').classList.add('hidden');
    $('#shell').classList.remove('hidden');
    $('#candidateName').textContent = name;
    $('#candidatePhone').textContent = mobile;
    $('#avatar').textContent = parts.slice(0,2).map(x => x[0]).join('') || 'م';
    build();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function init(){
    const startButton = $('#start');
    const mobileInput = $('#entryMobile');
    if (!startButton || !mobileInput) {
      console.error('Araak Recruitment: entry controls not found');
      return;
    }

    startButton.addEventListener('click', startApplication);
    mobileInput.addEventListener('keydown', event => { if (event.key === 'Enter') startApplication(event); });

    $('#prev').addEventListener('click', () => { if (step > 0) { step--; build(); window.scrollTo({top:0,behavior:'smooth'}); } });
    $('#next').addEventListener('click', () => { if (!validateCurrent()) return; if (step < steps.length - 1) { step++; build(); window.scrollTo({top:0,behavior:'smooth'}); } else toast('راجع البيانات ثم اضغط إرسال طلب التوظيف'); });
    $('#saveDraft').addEventListener('click', () => saveDraft(true));
    $('#print').addEventListener('click', () => window.print());
    $('#closeSuccess').addEventListener('click', () => $('#success').classList.add('hidden'));
    $('#backdrop').addEventListener('click', () => $('#success').classList.add('hidden'));
    $('#language').addEventListener('change', event => {
      const lang = event.target.value;
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      toast(lang === 'ar' ? 'العربية مفعلة' : lang === 'en' ? 'English selected — bilingual form' : 'Français sélectionné — formulaire bilingue');
    });

    if (value('entryName')) {
      $('#entryName').value = value('entryName');
      $('#entryMobile').value = value('entryMobile') || value('mobile');
    }
    progress();
    window.__ARAAK_APP_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();