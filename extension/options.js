const formEl = document.getElementById('instanceForm');
const idInputEl = document.getElementById('instanceId');
const nameInputEl = document.getElementById('instanceName');
const baseUrlInputEl = document.getElementById('instanceBaseUrl');
const passwordInputEl = document.getElementById('instancePassword');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const testBtn = document.getElementById('testBtn');
const localeSelectEl = document.getElementById('localeSelect');
const instancesListEl = document.getElementById('instancesList');
const statusEl = document.getElementById('status');

let config = { activeInstanceId: '', locale: 'zh-CN', instances: [] };

formEl.addEventListener('submit', handleSubmit);
cancelEditBtn.addEventListener('click', resetForm);
testBtn.addEventListener('click', handleTestCurrentForm);
localeSelectEl?.addEventListener('change', handleLocaleChange);

void refresh();

async function refresh() {
  const res = await sendMessage('ext:listInstances');
  if (!res.ok) {
    setStatus(`读取配置失败：${res.error}`, true);
    return;
  }
  config = res.config || { activeInstanceId: '', locale: 'zh-CN', instances: [] };
  syncLocaleSelect();
  renderInstances();
}

function renderInstances() {
  const instances = config.instances || [];
  if (!instances.length) {
    instancesListEl.className = 'instances-empty';
    instancesListEl.innerHTML = '暂无实例，请先新增。';
    return;
  }

  const container = document.createElement('div');
  container.className = 'instances';

  instances.forEach((item) => {
    const wrapper = document.createElement('article');
    wrapper.className = `instance-item ${item.id === config.activeInstanceId ? 'is-active' : ''}`;

    const top = document.createElement('div');
    top.className = 'instance-top';

    const name = document.createElement('div');
    name.className = 'instance-name';
    name.textContent = item.name;
    top.appendChild(name);

    if (item.id === config.activeInstanceId) {
      const tag = document.createElement('span');
      tag.className = 'instance-tag';
      tag.textContent = '当前使用';
      top.appendChild(tag);
    }

    const url = document.createElement('div');
    url.className = 'instance-url';
    url.textContent = item.baseUrl;

    const actions = document.createElement('div');
    actions.className = 'instance-actions';

    const editBtn = createBtn('编辑', 'btn btn-ghost', () => {
      idInputEl.value = item.id;
      nameInputEl.value = item.name;
      baseUrlInputEl.value = item.baseUrl;
      passwordInputEl.value = item.password || '';
      cancelEditBtn.classList.remove('hidden');
      nameInputEl.focus();
    });
    actions.appendChild(editBtn);

    const testBtn = createBtn('测试', 'btn btn-ghost', async () => {
      await testInstance(item);
    });
    actions.appendChild(testBtn);

    if (item.id !== config.activeInstanceId) {
      const activeBtn = createBtn('设为默认', 'btn btn-ghost', async () => {
        const res = await sendMessage('ext:setActiveInstance', { id: item.id });
        if (!res.ok) {
          setStatus(`切换失败：${res.error}`, true);
          return;
        }
        config = res.config;
        renderInstances();
        setStatus('已切换默认实例');
      });
      actions.appendChild(activeBtn);
    }

    const removeBtn = createBtn('删除', 'btn btn-ghost btn-danger', async () => {
      const confirmed = window.confirm(`确认删除实例 "${item.name}"？`);
      if (!confirmed) return;
      const res = await sendMessage('ext:removeInstance', { id: item.id });
      if (!res.ok) {
        setStatus(`删除失败：${res.error}`, true);
        return;
      }
      config = res.config;
      renderInstances();
      if (idInputEl.value === item.id) {
        resetForm();
      }
      setStatus('删除成功');
    });
    actions.appendChild(removeBtn);

    const openBtn = createBtn('打开站点', 'btn btn-ghost', () => {
      void chrome.tabs.create({ url: item.baseUrl });
    });
    actions.appendChild(openBtn);

    wrapper.appendChild(top);
    wrapper.appendChild(url);
    wrapper.appendChild(actions);
    container.appendChild(wrapper);
  });

  instancesListEl.className = '';
  instancesListEl.innerHTML = '';
  instancesListEl.appendChild(container);
}

async function handleSubmit(event) {
  event.preventDefault();
  setStatus('');

  const payload = {
    id: idInputEl.value || undefined,
    name: nameInputEl.value.trim(),
    baseUrl: baseUrlInputEl.value.trim(),
    password: passwordInputEl.value,
  };

  if (!payload.name || !payload.baseUrl) {
    setStatus('请填写名称和 Worker 地址', true);
    return;
  }

  const res = await sendMessage('ext:upsertInstance', payload);
  if (!res.ok) {
    setStatus(`保存失败：${res.error}`, true);
    return;
  }

  config = res.config;
  renderInstances();
  resetForm();
  setStatus('保存成功');
}

async function handleTestCurrentForm() {
  const baseUrl = baseUrlInputEl.value.trim();
  const password = passwordInputEl.value;
  if (!baseUrl) {
    setStatus('请先填写 Worker 地址', true);
    return;
  }
  setStatus('连接测试中...');
  const res = await sendMessage('ext:testConnection', { baseUrl, password });
  if (!res.ok) {
    setStatus(`连接失败：${res.error}`, true);
    return;
  }
  setStatus(`连接成功，当前记录 ${res.result.total} 条`);
}

async function testInstance(instance) {
  setStatus(`测试实例 "${instance.name}" 中...`);
  const res = await sendMessage('ext:testConnection', {
    baseUrl: instance.baseUrl,
    password: instance.password || '',
  });
  if (!res.ok) {
    setStatus(`连接失败：${res.error}`, true);
    return;
  }
  setStatus(`"${instance.name}" 连接成功，记录 ${res.result.total} 条`);
}

async function handleLocaleChange() {
  const locale = localeSelectEl?.value || 'zh-CN';
  const res = await sendMessage('ext:setLocale', { locale });
  if (!res.ok) {
    setStatus(`语言保存失败：${res.error}`, true);
    syncLocaleSelect();
    return;
  }
  config = res.config;
  syncLocaleSelect();
  setStatus('语言已保存');
}

function syncLocaleSelect() {
  if (!localeSelectEl) return;
  const locale = String(config.locale || 'zh-CN');
  localeSelectEl.value = locale === 'en' ? 'en' : 'zh-CN';
}

function resetForm() {
  idInputEl.value = '';
  formEl.reset();
  cancelEditBtn.classList.add('hidden');
}

function setStatus(text, isError = false) {
  statusEl.textContent = text || '';
  statusEl.classList.toggle('is-error', Boolean(isError));
}

function createBtn(text, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response' });
    });
  });
}
