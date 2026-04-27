const fs = require('fs');

const path = '/Volumes/Black6T/Nexus_Dev/antigravity/src/App.jsx';
const content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');

const startIdx = lines.findIndex(line => line.includes("{sidebarTab === 'files' ? ("));
let endIdx = -1;

for (let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes(") : sidebarTab === 'navigate' ? (")) {
    endIdx = i;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const newComponent = `                  {sidebarTab === 'files' ? (
                    <SidebarFilesTab
                      projectHandle={projectHandle}
                      projectContextMenu={projectContextMenu}
                      setProjectContextMenu={setProjectContextMenu}
                      handleRenameProject={handleRenameProject}
                      handleMoveProject={handleMoveProject}
                      setProjectHandle={setProjectHandle}
                      setFileTree={setFileTree}
                      setActiveFileHandle={setActiveFileHandle}
                      setText={setText}
                      setIsProjectMode={setIsProjectMode}
                      handleCreateNewProject={handleCreateNewProject}
                      savedProjectHandle={savedProjectHandle}
                      handleResumeProject={handleResumeProject}
                      handleOpenProject={handleOpenProject}
                      setShowCardCreator={setShowCardCreator}
                      handleRefreshTree={handleRefreshTree}
                      isMaterialsLoading={isMaterialsLoading}
                      fileTree={fileTree}
                      activeFileHandle={activeFileHandle}
                      handleFileSelect={handleFileSelect}
                      handleCreateFileInProject={handleCreateFileInProject}
                      handleCreateFolderInProject={handleCreateFolderInProject}
                      setPendingCreateParent={setPendingCreateParent}
                      setInputModalMode={setInputModalMode}
                      setInputModalValue={setInputModalValue}
                      setShowInputModal={setShowInputModal}
                      handleOpenReference={handleOpenReference}
                      handleOpenInNewWindow={handleOpenInNewWindow}
                      handleRename={handleRename}
                      handleDelete={handleDelete}
                      handleDuplicateFile={handleDuplicateFile}
                      handleMoveItem={handleMoveItem}
                      handleSaveFile={handleSaveFile}
                      fileInputRef={fileInputRef}
                      debouncedText={debouncedText}
                      showToast={showToast}
                      handlePrint={handlePrint}
                      openInputModal={openInputModal}
                      handleLoadFile={handleLoadFile}
                    />`;
                    
  lines.splice(startIdx, endIdx - startIdx, newComponent);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('Successfully replaced SidebarFilesTab JSX');
} else {
  console.log('Could not find start or end index', { startIdx, endIdx });
}
