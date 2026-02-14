import ExpoModulesCore
import MusicKit
import Foundation

public class TickemoPlayerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TickemoPlayer")

    // 再生関数: JSからID(String)を受け取る
    AsyncFunction("play") { (songId: String) async throws in
      // 1. 権限確認
      let status = await MusicAuthorization.request()
      if status != .authorized {
        throw NSError(domain: "MusicKit", code: 401, userInfo: [NSLocalizedDescriptionKey: "Apple Musicへのアクセス権限がありません"])
      }

      // 2. IDで曲を検索
      let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(songId))
      let response = try await request.response()

      guard let song = response.items.first else {
        throw NSError(domain: "MusicKit", code: 404, userInfo: [NSLocalizedDescriptionKey: "曲が見つかりませんでした"])
      }

      // 3. 再生キューにセットして再生
      SystemMusicPlayer.shared.queue = [song]
      try await SystemMusicPlayer.shared.play()
    }

    // 停止関数
    AsyncFunction("stop") {
      SystemMusicPlayer.shared.stop()
    }
  }
}

