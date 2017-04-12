module.exports = {
  title: "pimatic-onkyneer-remote device config schemas",
  OnkyneerSensor: {
    title: "OnkyneerSensor config options",
    type: "object",
    extensions: ["xAttributeOptions"],
    properties: {
      attributes: {
        description: "Attributes of the device",
        type: "array"
      }
    }
  }
};