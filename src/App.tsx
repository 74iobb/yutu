import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import YutuApp from '@/pages/YutuApp';
import ElectricalLab from '@/pages/ElectricalLab';
import Sandbox from '@/pages/Sandbox';
import ErrorBoundary from '@/components/ErrorBoundary';
import { YutuProvider } from '@/store/YutuContext';

/**
 * 域途 / 沙盘共用同一份 YutuProvider：
 * 在沙盘里采纳计划后，回到主流程能直接看到新写入的体验任务。
 * 电气实训是纯前端演示，不挂载数据层。
 */
function YutuLayout() {
  return (
    <ErrorBoundary>
      <YutuProvider>
        <Outlet />
      </YutuProvider>
    </ErrorBoundary>
  );
}

/**
 * 根应用：使用 HashRouter，保证静态托管下路由可用。
 * `#/` 直接渲染四步业务主流程。
 */
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<YutuLayout />}>
          <Route path='/' element={<YutuApp />} />
          <Route path='/sandbox' element={<Sandbox />} />
        </Route>
        <Route path='/electrical' element={<ElectricalLab />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
