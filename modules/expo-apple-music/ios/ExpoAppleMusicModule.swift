import ExpoModulesCore
import MusicKit

public class ExpoAppleMusicModule: Module {
  private var musicPlayer = ApplicationMusicPlayer.shared
  private var developerToken: String?
  
  public func definition() -> ModuleDefinition {
    Name("ExpoAppleMusic")
    
    AsyncFunction("configure") { (token: String) -> Void in
      self.developerToken = token
    }
    
    AsyncFunction("authorize") { () async -> Bool in
      let status = await MusicAuthorization.request()
      return status == .authorized
    }
    
    AsyncFunction("play") { (songId: String) async throws -> Void in
      guard self.developerToken != nil else {
        throw NSError(domain: "ExpoAppleMusic", code: -1, 
          userInfo: [NSLocalizedDescriptionKey: "Developer token not set"])
      }
      
      let request = MusicCatalogResourceRequest<Song>(
        matching: \.id, 
        equalTo: MusicItemID(songId)
      )
      let response = try await request.response()
      
      guard let song = response.items.first else {
        throw NSError(domain: "ExpoAppleMusic", code: -2, 
          userInfo: [NSLocalizedDescriptionKey: "Song not found"])
      }
      
      self.musicPlayer.queue = [song]
      try await self.musicPlayer.play()
    }
    
    AsyncFunction("pause") { () -> Void in
      self.musicPlayer.pause()
    }
    
    AsyncFunction("stop") { () -> Void in
      self.musicPlayer.stop()
    }
    
    AsyncFunction("isAuthorized") { () -> Bool in
      return MusicAuthorization.currentStatus == .authorized
    }
    
    AsyncFunction("searchArtists") { (term: String) async throws -> String in
      guard !term.isEmpty else {
        return "[]"
      }
      
      var request = MusicCatalogSearchRequest(term: term, types: [Artist.self])
      request.limit = 10
      
      let response = try await request.response()
      
      var results: [[String: String]] = []
      
      for artist in response.artists {
        var artistData: [String: String] = [:]
        artistData["id"] = artist.id.rawValue
        artistData["name"] = artist.name
        
        // Get artwork URL with 300x300 size
        if let artwork = artist.artwork {
          let imageUrl = artwork.url(width: 300, height: 300)?.absoluteString ?? ""
          artistData["imageUrl"] = imageUrl
        } else {
          artistData["imageUrl"] = ""
        }
        
        results.append(artistData)
      }
      
      // Convert to JSON string
      let jsonData = try JSONSerialization.data(withJSONObject: results, options: [])
      return String(data: jsonData, encoding: .utf8) ?? "[]"
    }
  }
}
