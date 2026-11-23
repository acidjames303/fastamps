const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// Bootstrap params that can repoint the SDK or inject a session. Never persist
// these from an arbitrary query string on the public Connect host.
const EPHEMERAL_BOOTSTRAP_PARAMS = new Set([
	'app_id',
	'access_token',
	'app_base_url',
	'functions_version',
]);

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		const persistFromQuery = !EPHEMERAL_BOOTSTRAP_PARAMS.has(paramName);
		if (persistFromQuery) {
			storage.setItem(storageKey, searchParam);
		}
		return searchParam;
	}
	if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	// access_token may appear once after OAuth — use it for this load only; do not
	// leave app_id / app_base_url / functions_version writable via crafted URLs.
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID, removeFromUrl: true }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: typeof window !== 'undefined' ? window.location.href : undefined }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION, removeFromUrl: true }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL, removeFromUrl: true }),
	}
}


export const appParams = {
	...getAppParams()
}
