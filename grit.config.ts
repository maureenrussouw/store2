// Grit Framework Configuration
export default {
  name: "store2",
  style: "default",
  api: {
    port: 8080,
    prefix: "/api",
  },
  web: {
    port: 3000,
  },
  admin: {
    port: 3001,
  },
  desktop: {
    framework: "wails",
    port: 5174,
  },
};
