import ExpoModulesCore

public class MemoryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MemoryModule")

    AsyncFunction("getMemoryInfo") { (promise: Promise) in
      var info = mach_task_basic_info()
      var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

      let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
          task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
      }

      if result == KERN_SUCCESS {
        let usedMB = Double(info.resident_size) / 1024.0 / 1024.0
        let virtualMB = Double(info.virtual_size) / 1024.0 / 1024.0

        // Get system memory info
        let totalMemory = ProcessInfo.processInfo.physicalMemory
        let totalMB = Double(totalMemory) / 1024.0 / 1024.0

        // Get available memory for the process
        let availableMB = Double(os_proc_available_memory()) / 1024.0 / 1024.0

        promise.resolve([
          "usedMb": usedMB,
          "virtualMb": virtualMB,
          "totalMb": totalMB,
          "availableMb": availableMB,
          "usedPercent": (usedMB / totalMB) * 100,
          "platform": "ios"
        ] as [String: Any])
      } else {
        promise.reject("MEMORY_ERROR", "Failed to get memory info: kern result \(result)")
      }
    }

    // Synchronous version for quick checks
    Function("getMemoryUsageMb") { () -> Double in
      var info = mach_task_basic_info()
      var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

      let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
          task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
      }

      if result == KERN_SUCCESS {
        return Double(info.resident_size) / 1024.0 / 1024.0
      }
      return -1.0
    }
  }
}
