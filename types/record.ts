export interface ChekiRecord {
  id: string;          // uuid
  user_id: string;     // Supabase AuthのユーザーID
  artist: string;
  liveName: string;    // DBカラム: live_name
  date: string;        // DBカラム: event_date (YYYY-MM-DD)
  venue?: string;
  seat?: string;
  startTime?: string;  // DBカラム: start_time
  endTime?: string;    // DBカラム: end_time
  imagePath?: string;  // DBカラム: image_path (Storageのパス)
  imageUrl?: string;   // 表示用の一時的な署名付きURL (DBには保存しない・先頭画像)
  imageUrls?: string[]; // 最大6枚の画像URL配列
  memo: string;
  detail?: string;     // DBカラム: setlist
  qrCode?: string;     // DBカラム: qr_code_data
  createdAt: string;   // DBカラム: created_at
}
