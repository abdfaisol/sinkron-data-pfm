module.exports = {
  apps: [
    {
      name: "sinkron-data",
      script: "./index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3021,
      },
      out_file: "./log/pm2-out.log",
      error_file: "./log/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
