const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function operatorSigning(config) {
  return withAppBuildGradle(config, (result) => {
    const marker = "// IndianXtrade operator signing";
    if (result.modResults.contents.includes(marker)) return result;
    result.modResults.contents += `
${marker}
if (System.getenv("PAYMENT_RELAY_KEYSTORE")) {
    android.signingConfigs.create("operatorRelease") {
        storeFile file(System.getenv("PAYMENT_RELAY_KEYSTORE"))
        storePassword System.getenv("PAYMENT_RELAY_STORE_PASSWORD")
        keyAlias System.getenv("PAYMENT_RELAY_KEY_ALIAS")
        keyPassword System.getenv("PAYMENT_RELAY_KEY_PASSWORD")
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.operatorRelease
}
`;
    return result;
  });
};
