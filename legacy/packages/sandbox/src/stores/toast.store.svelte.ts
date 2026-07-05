export const toastStore = (() => {
  let selectedSlug = $state<string | null>(null);

  return {
    get selectedSlug() { return selectedSlug; },
    setSlug(slug: string | null) { selectedSlug = slug; },
  };
})();
