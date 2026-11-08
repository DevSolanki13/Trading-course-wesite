// Install the QR development client beside the operator's production relay.
module.exports = ({ config }) => {
  if (process.env.PAYMENT_RELAY_VARIANT !== "development") return config;
  return {
    ...config,
    name: "IndianXtrade Payments Dev",
    scheme: "indianxtradepaymentsdev",
    android: { ...config.android, package: "com.indianxtrade.payments.dev" },
    plugins: config.plugins.map((plugin) =>
      Array.isArray(plugin) && plugin[0] === "expo-build-properties"
        ? [
            plugin[0],
            { ...plugin[1], android: { ...plugin[1].android, usesCleartextTraffic: true } },
          ]
        : plugin,
    ),
  };
};
