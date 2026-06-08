import localforage from 'localforage';

// Configure localForage for the application
localforage.config({
  name: 'llm-chat-ui',
  storeName: 'app_data',
  driver: localforage.INDEXEDDB,
});

export default localforage;
