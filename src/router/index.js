import { createRouter, createWebHistory } from "vue-router";

// This app loads project definitions at runtime from the `public` folder.
// The router provides only a minimal set of routes; project navigation is handled
// in `App.vue` by fetching JSON files from `/projects/json/...`.
const routes = [
  { path: "/", name: "home", component: { template: '<div/>"' } },
  {
    path: "/:pathMatch(.*)*",
    name: "notfound",
    component: { template: "<div>Not found</div>" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export { routes };
export default router;
