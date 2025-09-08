export const createState = (initialState, onChange) => {
  const state = new Proxy(initialState, {
    get(target, prop) {
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      if (typeof onChange[prop] === "function") {
        onChange[prop](value);
      }
      return true;
    },
  });
  return state;
};
