# Monthly report photos

## Context

The monthly HTML report had a front / side / back photo comparison. In the app the client uploads three photos with the monthly report, and the coach compares them with last month's side by side.

Decisions:

- Photos are **required** to send a monthly report.
- The coach can **download** each photo. A blob plus `<a download>` is enough, so this is cheap.
- **No retention rule** for now.
- Photos are stored in **Postgres** (`bytea`), so the existing `scripts/backup.sh` dump covers them. No new volume or service.

## Acceptance criteria

1. In the Месяц tab, a "Фото" section shows three slots: Фас, Профиль, Спина.
2. Picking an image resizes it on the device (longest side 1600 px, JPEG quality 0.85), uploads it at once and shows a preview. It can be replaced or removed while the report is a draft.
3. Last month's photos show next to each slot, read-only, taken from the previous submitted monthly report.
4. Sending is refused while any of the three photos is missing. The empty slots are outlined, the same way as empty fields.
5. Upload rules:
   - Only the report owner can upload, and only to a monthly draft.
   - Only `image/jpeg`, `image/png` or `image/webp`, at most 5 MB. Anything else gets 400 or 413.
   - Uploading to a weekly report, or to one that is already submitted, gets 409.
6. Viewing rules: an image is served only to the report owner or the coach. Everyone else gets 404. Responses carry `Cache-Control: private, no-store`.
7. The coach's monthly report view shows each angle as "Прошлый месяц" next to "Этот месяц", with a "Скачать" button for each current photo. The downloaded file is named `LekaFit_<Имя>_<YYYY-MM>_<angle>.jpg`.
8. The coach notification says "Фото: 3 из 3".

## Slices

1. **API storage:**
   - `ReportPhotoEntity` with columns `report_id`, `angle` (`front`, `side` or `back`), `mime`, `data` (bytea) and `uploaded_at`. One photo per report and angle (unique pair), and photos are deleted with their report.
   - A migration for the new table.
   - `PhotosRepository`.
   - `PUT`, `DELETE` and `GET` on `/reports/:id/photos/:angle`, plus `GET /coach/reports/:id/photos/:angle`, which serves only submitted reports.
   - Uploads arrive as a raw body (`express.raw` for images, 5 MB limit, on this route only).
   - Report responses get `photos: { front, side, back }` (booleans) and `prevPhotosReportId`.
   - E2E tests in `apps/api/test/monthly-photos.test.ts`.
2. **Required on submit:** submitting a monthly report without all three photos returns 400, naming the missing angles. `monthlyMissingFields` gains `photos.<angle>`, and the notification gains its photo line.
3. **Client UI:**
   - A `Photos` tab in `MonthlyReportForm`.
   - A `resizeImage` helper using canvas, with a seam so tests can bypass it.
   - Authenticated image fetches through `request` with a blob response, shown via `URL.createObjectURL`.
   - Fake API support, and tests in `MonthlyReport.test.tsx`.
4. **Coach UI:** last month next to this month, read-only, with the download button. Tests in `CoachMonthly.test.tsx`.

## Risks and notes

- **HEIC:** iPhones may hand over HEIC files. The canvas re-encode converts them to JPEG in Telegram's WebView (Safari decodes HEIC). If decoding fails, the client shows an error.
- **Caddy:** the default request body size has no small limit, so no change is expected. Check it in staging.
- **Report list size:** the image bytes are never loaded in report lists. The repository selects only metadata.

## Verification

- Run `pnpm check`.
- Run Stryker on the photo service and repository.
- Do a manual run in Telegram on an iPhone to check camera input, HEIC handling and the download.
