/// <reference types="@dcloudio/types" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare const wx: any;
declare const tt: any;
