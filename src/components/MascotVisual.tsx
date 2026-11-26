import { useEffect, useState } from 'react';
import { Mascot } from './bits';

/**
 * 吉祥物视觉：优先使用 src/assets/mascot/ 下的本地视频 / 动图；
 * 其次使用用户提供的远程视频（在已登录的平台预览中由浏览器直接播放）；
 * 加载失败时回退到内置刘看山 SVG。
 *
 * 支持：webm / mp4 / mov（视频，静音自动循环）、gif / webp（动图）。
 * 由 import.meta.glob 在构建期收集本地素材，新增文件后重新构建即可。
 */
const ASSETS = import.meta.glob('../assets/mascot/*.{webm,mp4,mov,gif,webp}', {
  eager: true,
  as: 'url',
}) as Record<string, string>;

const LOCAL_VIDEO =
  Object.entries(ASSETS).find(([path]) => /\.(webm|mp4|mov)$/i.test(path))?.[1] ??
  '';
const IMAGE =
  Object.entries(ASSETS).find(([path]) => /\.(gif|webp)$/i.test(path))?.[1] ??
  '';

/**
 * 用户提供的吉祥物视频。使用相对路径，预览页与平台同源，
 * 浏览器会带上登录态；沙箱侧无需下载文件。
 * 想替换成本地文件，只需放到 src/assets/mascot/，本地素材优先级更高。
 */
const REMOTE_VIDEO =
  '/api/f/s3/app-dev/20261122/41b7cc64bc7d438989c06024b9115d74.mp4';

export default function MascotVisual({ className = '' }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const [motionOff, setMotionOff] = useState(() => {
    try {
      return (
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('y-motion-off')
      );
    } catch {
      return false;
    }
  });
  const videoSrc = LOCAL_VIDEO || REMOTE_VIDEO;

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () =>
      setMotionOff(
        Boolean(mq?.matches) ||
          document.documentElement.classList.contains('y-motion-off')
      );
    sync();
    mq?.addEventListener?.('change', sync);
    window.addEventListener('yutu:motion', sync);
    return () => {
      mq?.removeEventListener?.('change', sync);
      window.removeEventListener('yutu:motion', sync);
    };
  }, []);

  if (motionOff) return <Mascot />;
  if (!failed && videoSrc) {
    return (
      <video
        className={`y-mascot-media${className ? ` ${className}` : ''}`}
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload='auto'
        disablePictureInPicture
        aria-hidden='true'
        onError={() => setFailed(true)}
      />
    );
  }
  if (IMAGE) {
    return (
      <img
        className={`y-mascot-media${className ? ` ${className}` : ''}`}
        src={IMAGE}
        alt=''
        aria-hidden='true'
      />
    );
  }
  return <Mascot />;
}
