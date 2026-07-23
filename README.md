# Cloudflare Image Proxy
<p align="center">
  <img src="assets/banner.png" alt="Cloudflare Image Proxy Banner" width="100%" />
</p>
A production-ready, enterprise-grade image proxy built with Cloudflare Workers and TypeScript. Features image transformations, edge caching, rate limiting, and comprehensive SSRF protection.

## ✨ Features

### Core Features
- **Image Proxying**: Proxy any public image URL securely.
- **Image Transformations**: Resize, crop, optimize, and apply effects using the Cloudflare Image Resizing API.
- **Edge Caching**: Automatic caching with the Cloudflare Cache API for lightning-fast subsequent requests.
- **Rate Limiting**: IP-based rate limiting to prevent abuse and ensure fair usage.
- **SSRF Protection**: Enterprise-level security against Server-Side Request Forgery attacks.

### Supported Formats
- JPEG / JPG
- PNG
- GIF
- WebP
- AVIF
- SVG
- BMP
- ICO

### Transformation Parameters
- **Dimensions**: Width and height (1–10000px)
- **Quality**: 1–100
- **Format**: Auto, WebP, AVIF, JPEG, PNG
- **Fit Modes**: Scale-down, contain, cover, crop, pad
- **Gravity**: Center, left, right, top, bottom, auto
- **Effects**: Blur, brightness, contrast, gamma, sharpen
- **Rotation**: 0°, 90°, 180°, 270°
- **DPR**: Device pixel ratio (1x, 2x, 3x)

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript (strict mode, no `any`)
- **Module System**: ES Modules
- **Deployment**: Wrangler v3/v4
- **Caching**: Cloudflare Cache API
- **Image Processing**: Cloudflare Image Resizing API
- **Frontend**: HTML + CSS + Vanilla JavaScript (No frameworks)

## 📂 Project Structure

```text
cloudflare-image-proxy/
├── src/
│   ├── index.ts          # Main entry point and Worker handler
│   ├── router.ts         # Request routing and endpoint handling
│   ├── proxy.ts          # Image proxying and transformation logic
│   ├── security.ts       # SSRF protection and URL validation
│   ├── cache.ts          # Cloudflare Cache API management
│   ├── rateLimit.ts      # IP-based rate limiting logic
│   ├── validator.ts      # Input validation utilities
│   ├── utils.ts          # Reusable helper functions
│   └── types.ts          # TypeScript interfaces and types
├── public/
│   ├── index.html        # Premium responsive frontend UI
│   ├── style.css         # Glassmorphism styling and animations
│   └── script.js         # Frontend logic and LocalStorage history
├── wrangler.jsonc        # Wrangler configuration
├── package.json          # NPM dependencies and scripts
├── tsconfig.json         # Strict TypeScript configuration
├── README.md             # This documentation file
└── LICENSE               # MIT License
```

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm
- A Cloudflare account

### Setup

1. **Clone the repository**
```bash
   git clone https://github.com/your-username/cloudflare-image-proxy.git
   cd cloudflare-image-proxy
```

2. **Install dependencies**
```bash
   npm install
```

3. **Authenticate with Cloudflare**
```bash
   npx wrangler login
```

## 💻 Development

### Start Development Server
```bash
npm run dev
```
This starts Wrangler's local development server at `http://localhost:8787`.

### Type Checking
```bash
npm run typecheck
```
Validates TypeScript strict mode compliance without emitting files.

## 🌍 Deployment

### Deploy to Cloudflare
```bash
npm run deploy
```
Your Worker will be deployed and available at:  
`https://cloudflare-image-proxy.<your-subdomain>.workers.dev`

### Environment Variables
Configure these in your `wrangler.jsonc` or the Cloudflare Dashboard:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Maximum requests allowed per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds (1 minute) |
| `MAX_URL_LENGTH` | `2048` | Maximum allowed length for the source URL |
| `REQUEST_TIMEOUT_MS` | `30000` | Maximum time to wait for an image fetch |

## 📖 API Documentation

### Proxy Endpoint
**GET** `/?url=<image_url>&w=<width>&h=<height>&q=<quality>&format=<format>`

#### Query Parameters

| Parameter | Type   | Required | Description                    | Valid Values                    |
|-----------|--------|----------|--------------------------------|---------------------------------|
| `url`     | string | Yes      | Source image URL               | Valid HTTP/HTTPS URL            |
| `w`       | number | No       | Width in pixels                | 1 - 10000                       |
| `h`       | number | No       | Height in pixels               | 1 - 10000                       |
| `q`       | number | No       | Output quality                 | 1 - 100                         |
| `format`  | string | No       | Output image format            | `avif`, `webp`, `jpeg`, `png`   |
| `fit`     | string | No       | Resizing fit mode              | `scale-down`, `contain`, `cover`, `crop`, `pad` |
| `gravity` | string | No       | Crop gravity anchor            | `center`, `left`, `right`, `top`, `bottom`, `auto` |
| `blur`    | number | No       | Blur intensity                 | 0 - 100                         |
| `brightness`|number| No       | Brightness adjustment          | -100 to 100                     |
| `contrast`| number | No       | Contrast adjustment            | -100 to 100                     |
| `gamma`   | number | No       | Gamma correction               | 0.01 - 10                       |
| `rotate`  | number | No       | Rotation angle                 | `0`, `90`, `180`, `270`         |
| `sharpen` | number | No       | Sharpening amount              | 0 - 100                         |
| `background`|string| No       | Background color (for padding) | Hex color code (e.g., `#FFFFFF`)|
| `dpr`     | number | No       | Device pixel ratio             | `1`, `2`, `3`                   |

#### Example Request
```http
GET /?url=https://example.com/image.jpg&w=800&h=600&q=90&format=webp
```

### Utility Endpoints

- **GET `/health`**  
  Returns Worker health status and timestamp.
- **GET `/api/info`**  
  Returns API documentation and available endpoints in JSON format.

### HTTP Response Codes

| Code | Description                    |
|------|--------------------------------|
| `200`| Success                        |
| `304`| Not Modified (Cache Hit)       |
| `400`| Bad Request (Invalid parameters)|
| `403`| Forbidden (SSRF blocked)       |
| `404`| Not Found                      |
| `408`| Request Timeout                |
| `415`| Unsupported Media Type         |
| `429`| Too Many Requests (Rate Limited)|
| `500`| Internal Server Error          |
| `502`| Bad Gateway                    |
| `504`| Gateway Timeout                |

### Response Headers
- `X-Cache-Status`: `HIT` or `MISS`
- `X-Transform-Applied`: `true` or `false`
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Unix timestamp of when the rate limit resets

## 🔒 Security

### SSRF Protection
The proxy implements comprehensive SSRF (Server-Side Request Forgery) protection:
1. **Protocol Validation**: Only `http:` and `https:` protocols are allowed.
2. **Private IP Blocking**: Blocks all RFC 1918 private IP ranges, localhost (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and CGNAT (`100.64.0.0/10`).
3. **Metadata Service Blocking**: Prevents access to cloud provider metadata endpoints (e.g., `169.254.169.254`).
4. **Redirect Validation**: Intercepts and validates redirect URLs to prevent bypass attacks.
5. **URL Sanitization**: Strips null bytes, control characters, and dangerous protocols (`javascript:`, `data:`, `file:`, `ftp:`).

### Content-Type Validation
- Validates that the fetched resource returns a valid image MIME type.
- Rejects oversized URLs and invalid MIME types.

## ⚙️ Cloudflare Dashboard Settings

To ensure full functionality, configure the following in your Cloudflare Dashboard:

1. **Enable Image Resizing**  
   Navigate to **Cloudflare Dashboard** → **Images** → **Optimization** → Enable **Image Resizing**. *(Note: This feature requires a Pro, Business, or Enterprise plan, or a paid Images add-on).*
2. **Cache Settings**  
   Navigate to **Caching** → **Configuration** → Set Cache Level to **Standard**.
3. **Custom Domains (Optional)**  
   Navigate to **Workers & Pages** → Your Worker → **Triggers** → Add a custom domain route.

## 🗄️ Caching

The proxy leverages the Cloudflare Cache API for edge caching:
- **Cache Key**: Uniquely generated based on the source URL and all transformation parameters.
- **TTL**: Respects origin `Cache-Control` headers (capped at a maximum of 1 year).
- **Conditional Requests**: Fully supports `ETag` and `Last-Modified` headers for `304 Not Modified` responses.
- **Observability**: The `X-Cache-Status` header indicates whether a request was served from the edge (`HIT`) or fetched from the origin (`MISS`).

## 🎨 Frontend Features

The included UI is a premium, single-page application built without frameworks:
- **Design**: Modern dark mode, glassmorphism effects, and animated gradient backgrounds.
- **Responsive**: Fully mobile-friendly layout.
- **Live Preview**: Real-time image preview generation.
- **Controls**: Intuitive sliders and inputs for all transformation parameters.
- **Utilities**: One-click URL copying, direct image downloading, and form resetting.
- **History**: LocalStorage-based history tracking (saves the last 10 configurations).
- **Accessibility**: Keyboard shortcuts (`Ctrl` + `Enter` to generate) and toast notifications.

## 🧹 Code Quality

- **Strict TypeScript**: Zero `any` types, full interface definitions, and strict null checks.
- **Modular Architecture**: Clear separation of concerns (routing, proxying, security, caching).
- **Error Handling**: Comprehensive `try/catch` blocks and standardized JSON error responses.
- **Modern Patterns**: Extensive use of `async/await`, native `Fetch` API, and proper `Request`/`Response` typing.

## 🔧 Troubleshooting

### Common Issues

1. **Image not loading / 502 Bad Gateway**  
   - Verify the source URL is publicly accessible.
   - Check if the source server blocks Cloudflare IP ranges.
   - Inspect Worker logs via `npm run tail`.

2. **Transformations not applied**  
   - Ensure "Image Resizing" is explicitly enabled in your Cloudflare Dashboard.
   - Verify that parameter values fall within the documented valid ranges.

3. **Rate limit errors (429)**  
   - Increase `RATE_LIMIT_MAX_REQUESTS` in `wrangler.jsonc`.
   - For production, consider binding a Cloudflare KV namespace for distributed rate limiting.

### Debugging
```bash
# View live Worker logs
npm run tail

# Test health endpoint locally
curl http://localhost:8787/health
```

## 📈 Future Improvements

- [ ] Distributed rate limiting via Cloudflare KV
- [ ] Automatic WebP/AVIF conversion based on `Accept` header
- [ ] Image optimization presets (e.g., `?preset=thumbnail`)
- [ ] Webhook support for asynchronous image processing events
- [ ] Batch image processing endpoint
- [ ] Dynamic watermarking support
- [ ] OAuth/token-based authentication for private images

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📬 Support

For issues, bugs, or feature requests, please open an issue in the repository.

---

**Made with ❤️ using Cloudflare Workers & TypeScript**
