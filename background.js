importScripts(chrome.runtime.getURL('scripts/tf.es2017.js'));

const CHARACTERS = '123456789abcdefghijkmnopqrstuvwxyz';

let tfmodel;

async function loadModel() {
  try {
    tfmodel = await tf.loadLayersModel(chrome.runtime.getURL('model/model.json'));
    console.log('模型載入完成!');
  } catch (error) {
    console.error('模型載入失敗! 錯誤訊息:', error);
  }
}

async function solveCaptcha(captchaImage) {
  try {
    const response = await fetch(captchaImage);
    const blob = await response.blob();
    const imgBitmap = await createImageBitmap(blob);

    let tensor = tf.browser.fromPixels(imgBitmap)
      .resizeNearestNeighbor([30, 90])
      .toFloat()
      .div(255.0);
    tensor = tensor.mul([0.2989, 0.5870, 0.1140]).sum(-1).expandDims(-1);

    const prediction = tfmodel.predict(tensor.expandDims());
    const output = await Promise.all(prediction.map(p => p.data()));

    const result = output.map(array => CHARACTERS[array.indexOf(Math.max(...array))]).join('');

    tensor.dispose(); 
    return { status: 'solved', captcha: result };
  } catch (error) {
    console.error("錯誤訊息:", error);
    return { status: 'error', message: '無法辨識驗證碼' };
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(() => {
  console.debug('喚醒擴展!');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('初始化擴展!');
});

self.addEventListener('activate', () => {
  console.log('啟用擴展!');
});

self.addEventListener('install', async () => {
  await loadModel();
  self.skipWaiting();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'solve_captcha') {
    if (tfmodel) {
      solveCaptcha(request.image).then(sendResponse);
    } else {
      loadModel().then(() => {
        solveCaptcha(request.image).then(sendResponse);
      });
    }
    return true;
  }
});

loadModel();
