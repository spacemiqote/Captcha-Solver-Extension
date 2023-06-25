function isEportalUrl(url) {
    const eportalPattern = /eportal/i;
    return eportalPattern.test(url);
}

function captureAndSendCaptcha() {
    if (!isEportalUrl(window.location.href)) {
        return;
    }
    var xpath = "/html/body/div[1]/div[2]/form/div[3]/table/tbody/tr[1]/td/table/tbody/tr[3]/td[1]/img";
    var element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

    if (element) {
        if (element.complete) {
            sendCaptcha(element);
        } else {
            element.addEventListener('load', () => {
                sendCaptcha(element);
            });
        }
    }
}

function sendCaptcha(element) {
    var canvas = document.createElement("canvas");
    canvas.width = element.width;
    canvas.height = element.height;
    var context = canvas.getContext("2d");
    context.drawImage(element, 0, 0);
    var captchaImage = canvas.toDataURL("image/jpeg", 1);

    chrome.runtime.sendMessage({ action: "solve_captcha", image: captchaImage }, (response) => {
        if (response.status === "solved") {
            var inputElement = document.getElementById("ContentPlaceHolder1_ValidationCode");
            if (inputElement) {
                inputElement.value = response.captcha;
            }
        } else {
            console.log('驗證碼辨識失敗');
        }
    });
}

window.addEventListener('load', captureAndSendCaptcha);
