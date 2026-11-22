import { createApp } from 'vue';
import naive from 'naive-ui';
import router from './router';
import App from './App.vue';
import { setupMediaSinglePlay } from './lib/mediaSinglePlay';
import './theme/tokens.css';
import 'uno.css';

setupMediaSinglePlay();

createApp(App).use(router).use(naive).mount('#app');
