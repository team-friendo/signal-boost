const defaultStub = {
  run: () =>
    Promise.resolve({
      stop: () => Promise.resolve(),
    }),
}

module.exports = {
  db: defaultStub,
  sock: defaultStub,
  registrar: defaultStub,
  dispatcher: defaultStub,
}
