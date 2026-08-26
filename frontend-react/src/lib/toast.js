let listener = null;
let nextId = 1;

export function subscribeToast(fn) {
  listener = fn;
  return () => {
    listener = null;
  };
}

export function toast(message, variant = "default") {
  if (listener) listener({ id: nextId++, message, variant });
}
