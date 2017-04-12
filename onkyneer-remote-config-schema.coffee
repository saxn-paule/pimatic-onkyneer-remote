# onkyneer-remote configuration options
module.exports = {
  title: "onkyneer remote config options"
  type: "object"
  properties:
    host:
      description: "AVR IP address"
      type: "string"
      default: "192.168.0.15"
    maxVolume:
      description: "max Volume"
      type: "integer"
      default: 100
}