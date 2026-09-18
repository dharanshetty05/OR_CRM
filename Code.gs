var APP_NAME = 'ScaleWithLakshya Outreach CRM';
var APP_VERSION = 'CRM-MVP-0.1';

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppHealth() {
  return {
    success: true,
    app: APP_NAME,
    version: APP_VERSION,
    timestamp: new Date().toISOString()
  };
}
