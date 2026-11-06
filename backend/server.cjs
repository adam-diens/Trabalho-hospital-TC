const { loadEnv, readConfig } = require('./config.cjs');
const { createApplication } = require('./app.cjs');
loadEnv();
const config = readConfig();
const server = createApplication(config);
server.listen(config.port, config.host, () => console.log(`FHDOD API v2 em http://${config.host}:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close();
  const deadline = setTimeout(() => server.closeAllConnections(), 10000);
  deadline.unref();
});
