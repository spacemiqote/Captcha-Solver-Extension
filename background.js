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
    let sumConfidence = 0;
    let characters = output.map((array, index) => {
      const max = Math.max(...array);
      sumConfidence += max;
      return {char: CHARACTERS[array.indexOf(max)], confidences: array};
    });
    const avgConfidence = (sumConfidence / output.length) * 100;
    for (let i = 0; i < characters.length - 1; i++) {
      if (characters[i].char === characters[i + 1].char) {
        const confidences1 = characters[i].confidences.slice().sort((a, b) => b - a);
        const confidences2 = characters[i + 1].confidences.slice().sort((a, b) => b - a);

        if (confidences1[0] > confidences2[0]) {
          characters[i + 1].char = CHARACTERS[characters[i + 1].confidences.indexOf(confidences2[1])];
        } else {
          characters[i].char = CHARACTERS[characters[i].confidences.indexOf(confidences1[1])];
        }
      }
    }
    for (let i = 0; i < characters.length - 1; i++) {
      if (characters[i].char === characters[i + 1].char) {
        const confidences1 = characters[i].confidences.slice().sort((a, b) => b - a);
        const confidences2 = characters[i + 1].confidences.slice().sort((a, b) => b - a);
        let alternativeIndex = 2;
        let newChar;
        do {
          newChar = CHARACTERS[characters[i + 1].confidences.indexOf(confidences2[alternativeIndex])];
          alternativeIndex++;
        } while (newChar === characters[i + 1].char && alternativeIndex < confidences2.length);
        if (confidences1[0] > confidences2[0]) {
          characters[i + 1].char = newChar;
        } else {
          characters[i].char = newChar;
        }
      }
    }
    const result = characters.map(c => c.char).join('');
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
