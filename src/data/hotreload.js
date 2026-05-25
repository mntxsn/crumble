const filesInDirectory = (dir) =>
  new Promise((resolve) =>
    dir.createReader().readEntries((entries) =>
      Promise.all(
        entries
          .filter((e) => e.name[0] !== ".")
          .map((e) =>
            e.isDirectory
              ? filesInDirectory(e)
              : new Promise((resolve) => e.file(resolve))
          )
      )
        .then((files) => [].concat(...files))
        .then(resolve)
    )
  );

const timestampForFilesInDirectory = (dir) =>
  filesInDirectory(dir).then((files) =>
    files.map((f) => f.name + f.lastModifiedDate).join()
  );

const watchChanges = (dir, lastTimestamp) => {
  timestampForFilesInDirectory(dir).then((timestamp) => {
    if (!lastTimestamp || lastTimestamp === timestamp) {
      setTimeout(() => watchChanges(dir, timestamp), 1000); // retry after 1s
    } else {
      chrome.runtime.reload();
    }
  });
};

// Dev-only file-watch reload. Requires both `management` permission (for
// installType detection) and `getPackageDirectoryEntry` (MV2 only). If either
// is missing, silently no-op instead of throwing on module load.
if (
  typeof chrome !== "undefined" &&
  chrome.management &&
  typeof chrome.management.getSelf === "function" &&
  typeof chrome.runtime.getPackageDirectoryEntry === "function"
) {
  chrome.management.getSelf((self) => {
    if (self.installType === "development") {
      chrome.runtime.getPackageDirectoryEntry((dir) => watchChanges(dir));
    }
  });
}
