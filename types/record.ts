export interface ChekiRecord {
  id: string;          // uuid
  user_id?: string;     // ローカル識別用（任意）
  artist: string;
  artistImageUrl?: string; // アーティストの画像URL（Apple Music等から取得）
  liveName: string;    // DBカラム: live_name
  date: string;        // DBカラム: event_date (YYYY-MM-DD)
  venue?: string;
  seat?: string;
  startTime?: string;  // DBカラム: start_time
  endTime?: string;    // DBカラム: end_time
  imagePath?: string;  // DBカラム: image_path (Storageのパス)
  imageUrls?: string[]; // 最大6枚の画像URL配列
  imageAssetIds?: Array<string | null>; // imageUrls に対応するアルバムassetId
  memo: string;
  detail?: string;     // DBカラム: setlist
  qrCode?: string;     // DBカラム: qr_code_data
  createdAt: string;   // 作成日時 (ISO)
}
