import AppKit
let path = CommandLine.arguments[1]
FileManager.default.createFile(atPath: path, contents: Data("start".utf8))
func stamp() -> Date? { (try? FileManager.default.attributesOfItem(atPath: path))?[.modificationDate] as? Date }
var seen = stamp()
var last = Date()
Timer.scheduledTimer(withTimeInterval: 0.01, repeats: true) { _ in
  let now = stamp()
  if now != seen {
    seen = now
    last = Date()
    let text = (try? String(contentsOfFile: path, encoding: .utf8)) ?? ""
    if text.hasPrefix("quit") { exit(0) }
    NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .now)
  }
  if Date().timeIntervalSince(last) > 120 { exit(0) }
}
RunLoop.main.run()
