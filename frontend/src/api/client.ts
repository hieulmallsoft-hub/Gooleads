import { API_BASE_URL } from '../config/googleAds';

export const AUTH_SESSION_EXPIRED_EVENT = 'ggads:auth-session-expired';

function getApiBaseUrls() {
  const configuredBaseUrl = String(API_BASE_URL).replace(/\/$/, '');
  const isLocalBrowser =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const localFallbacks =
    isLocalBrowser ||
    configuredBaseUrl.includes('localhost') ||
    configuredBaseUrl.includes('127.0.0.1') ||
    configuredBaseUrl.includes('[::1]')
      ? ['http://127.0.0.1:3001', 'http://localhost:3001']
      : [];

  if (!configuredBaseUrl && localFallbacks.length > 0) {
    return Array.from(new Set(['', ...localFallbacks]));
  }

  return Array.from(new Set([configuredBaseUrl, ...localFallbacks, '']));
}

export async function apiFetch(path: string, options?: RequestInit) {
  let lastError: unknown;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await window.fetch(`${baseUrl}${path}`, {
        credentials: 'include',
        ...options,
      });
      const contentType = response.headers.get('content-type') ?? '';
      const isUnexpectedHtml =
        response.ok &&
        contentType.includes('text/html') &&
        path.startsWith('/');

      if (isUnexpectedHtml) {
        lastError = new Error(`API route ${path.split('?')[0]} returned the frontend page`);
        continue;
      }

      if (
        response.status === 401 &&
        path !== '/auth/login' &&
        path !== '/auth/me' &&
        path !== '/auth/logout'
      ) {
        window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    toVietnameseApiError(lastError instanceof Error ? lastError.message : 'Failed to fetch'),
  );
}

export async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html') || text.trimStart().startsWith('<!doctype')) {
      throw new Error(
        'Frontend đang gọi nhầm sang trang web thay vì backend API. Hãy kiểm tra VITE_API_BASE_URL hoặc restart frontend dev server.',
      );
    }
    return text;
  }
}

export function toVietnameseApiError(
  message: unknown,
  fallback = 'Có lỗi xảy ra. Vui lòng thử lại.',
) {
  const raw = String(message ?? '').trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();

  if (
    normalized.includes('user_permission_denied') ||
    normalized.includes("doesn't have permission") ||
    normalized.includes('does not have permission') ||
    normalized.includes('caller does not have permission')
  ) {
    return 'Tài khoản Google Ads/API hiện tại không có quyền truy cập customer này. Nếu đây là tài khoản con, cần cấu hình đúng MCC/login customer ID hoặc xin cấp quyền trong Google Ads.';
  }

  // AI providers (notably Gemini) use PERMISSION_DENIED for API key/project/model
  // authorization failures. Handle that before the generic application permission
  // branch below so an admin is not incorrectly told to request campaign access.
  if (
    normalized.includes('permission_denied') ||
    normalized.includes('permission denied')
  ) {
    return 'Dịch vụ AI từ chối yêu cầu. Hãy kiểm tra API key, quyền của Google Cloud project, billing và quyền truy cập model Gemini/OpenAI rồi restart backend.';
  }

  if (normalized.includes('login-customer-id')) {
    return 'Khách hàng này có thể nằm dưới MCC. Hãy cấu hình đúng ID khách hàng đăng nhập/MCC trong backend hoặc phần Cài đặt.';
  }

  if (normalized.includes('not configured in the database')) {
    return 'Tài khoản Google Ads này chưa được cấu hình trong cơ sở dữ liệu. Hãy vào Cài đặt để thêm kết nối/khách hàng hoặc kiểm tra ID khách hàng đang chọn.';
  }

  if (
    normalized.includes('quotaerror') ||
    normalized.includes('resource_exhausted') ||
    (
      normalized.includes('too many requests') &&
      normalized.includes('retry in')
    )
  ) {
    return 'Google Ads API đã hết hạn mức gọi. Dữ liệu chiến dịch trực tiếp tạm thời không tải được; hãy chờ đến thời gian Google cho phép thử lại.';
  }

  if (normalized.includes('quota') || normalized.includes('insufficient_quota')) {
    return 'Dịch vụ AI đã hết quota hoặc chưa bật billing. Hãy kiểm tra API key, hạn mức và billing của Gemini/OpenAI.';
  }

  if (normalized.includes('missing gemini_api_key')) {
    return 'Backend chưa có GEMINI_API_KEY. Hãy thêm key vào backend/.env rồi restart backend.';
  }

  if (normalized.includes('missing openai_api_key')) {
    return 'Backend chưa có OPENAI_API_KEY. Hãy thêm key vào backend/.env rồi restart backend.';
  }

  if (normalized.includes('invalid_grant')) {
    return 'Token Google đã hết hạn hoặc bị thu hồi. Hãy tạo hoặc làm mới OAuth credentials cho Google Ads API.';
  }

  if (normalized.includes('developer_token')) {
    return 'Backend thiếu hoặc sai GOOGLE_ADS_DEVELOPER_TOKEN. Hãy kiểm tra file .env hoặc google-ads.yaml.';
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('load failed') ||
    normalized.includes('networkerror')
  ) {
    return 'Không kết nối được backend. Hãy kiểm tra backend đã chạy chưa, đúng port 3001 chưa, và frontend có cấu hình đúng API URL không.';
  }

  if (normalized.includes('eaddrinuse')) {
    return 'Port backend đang bị chương trình khác dùng. Hãy tắt process cũ hoặc đổi PORT.';
  }

  if (normalized.includes('api route') && normalized.includes('frontend page')) {
    return 'Frontend đang gọi nhầm route frontend thay vì backend API. Hãy kiểm tra VITE_API_BASE_URL và restart frontend.';
  }

  if (normalized.includes('illegal invocation')) {
    return 'Trình duyệt gọi API sai context. Hãy refresh trang, nếu vẫn lỗi thì restart frontend dev server.';
  }

  if (normalized.includes('aspect_ratio_not_allowed')) {
    return 'Ảnh thay thế không đúng tỷ lệ Google Ads yêu cầu. Hãy dùng ảnh đúng kích thước/tỷ lệ của asset gốc.';
  }

  if (normalized.includes('too_long') || normalized.includes('stringlengtherror')) {
    return 'Nội dung gợi ý quá dài so với giới hạn Google Ads. Headline tối đa 30 ký tự, description tối đa 90 ký tự.';
  }

  if (normalized.includes('field_has_subfields') || normalized.includes('field mask')) {
    return 'Google Ads từ chối cập nhật vì field mask chưa đúng. Cần backend cập nhật đúng trường con của asset/ad.';
  }

  if (normalized.includes('invalid json') || normalized.includes('unterminated string')) {
    return 'AI trả về dữ liệu không đúng định dạng JSON. Hãy bấm Generate lại, nếu lặp lại thì cần siết prompt/response schema.';
  }

  if (normalized.includes('no assets with low label')) {
    return 'Không tìm thấy asset có label LOW trong ad group và khoảng ngày đang chọn.';
  }

  if (normalized.includes('no low headline/description')) {
    return 'Không có headline hoặc description label LOW để tạo gợi ý text trong khoảng ngày này.';
  }

  if (normalized.includes('unauthorized') || normalized.includes('please sign in')) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  }

  if (normalized.includes('forbidden') || normalized.includes('permission')) {
    return 'Bạn chưa có quyền thực hiện thao tác này. Hãy nhờ admin cấp quyền campaign hoặc quyền chỉnh sửa.';
  }

  return raw;
}

export function extractApiError(body: any, fallback: string) {
  const skippedReason = Array.isArray(body?.message?.skippedAds)
    ? body.message.skippedAds
        .map((item: any) => item?.reason)
        .find((reason: unknown): reason is string => typeof reason === 'string' && reason.length > 0)
    : '';

  if (typeof body?.message === 'string') {
    return toVietnameseApiError(body.message, fallback);
  }

  if (typeof body?.message?.message === 'string') {
    return toVietnameseApiError([body.message.message, skippedReason].filter(Boolean).join(': '), fallback);
  }

  if (typeof body?.message?.details?.error?.message === 'string') {
    return toVietnameseApiError(body.message.details.error.message, fallback);
  }

  if (typeof body?.error?.message === 'string') {
    return toVietnameseApiError(body.error.message, fallback);
  }

  if (typeof body === 'string') {
    return toVietnameseApiError(body, fallback);
  }

  return fallback;
}
