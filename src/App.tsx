import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import YutuApp from '@/pages/YutuApp';

/**
 * 根应用：使用 HashRouter，保证静态托管下路由可用。
 * `#/` 直接渲染五步业务主流程。
 */
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<YutuApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
