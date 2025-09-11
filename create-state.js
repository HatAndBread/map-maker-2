export const createState = (initialState, onChange) => {
  const state = new Proxy(initialState, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
      Reflect.set(target, prop, value);
      if (typeof onChange[prop] === "function") {
        onChange[prop](value);
      }
      return true;
    },
  });
  return state;
};
