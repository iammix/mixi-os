function useInitialWindowSize({ margin }: {margin ?: number }) {
    let m = margin || 0;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let initWidth = winW - m;
    let initHeight = winH - m;

    return {initWidth, initHeight};
}

export default useInitialWindowSize;