import { getScreenSize } from '../components/room/screenSpace';

function useInitialWindowSize({ margin }: {margin ?: number }) {
    let m = margin || 0;

    const { width: winW, height: winH } = getScreenSize();
    let initWidth = winW - m;
    let initHeight = winH - m;

    return {initWidth, initHeight};
}

export default useInitialWindowSize;
