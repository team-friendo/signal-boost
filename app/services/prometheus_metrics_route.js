/*

  `registry` is a prom-client `Registry`, i.e. an object providing two methods:

    contentType(): returns the HTTP content type of the object returned by `metrics`.

    metrics(): returns the string to respond with in the HTTP request made by prometheus.

  https://github.com/siimon/prom-client
*/
function prometheusMetricsRoute(registry) {
  return async ctx => {
    Object.assign(ctx, {
      type: registry.contentType,
      body: registry.metrics()
    })
  }
}

module.exports = { prometheusMetricsRoute }
