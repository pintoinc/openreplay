import Hls from 'hls.js';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { useStore } from 'App/mstore';

import spotPlayerStore from '../spotPlayerStore';

const base64toblob = (str: string) => {
  const byteCharacters = atob(str);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray]);
};

function SpotVideoContainer({
  videoURL,
  streamFile,
  thumbnail,
  checkReady,
}: {
  videoURL: string;
  streamFile?: string;
  thumbnail?: string;
  checkReady: () => Promise<boolean>;
}) {
  const [prevIsProcessing, setPrevIsProcessing] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isLoaded, setLoaded] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const playbackTime = React.useRef(0);
  const hlsRef = React.useRef<Hls | null>(null);

  React.useEffect(() => {
    const startPlaying = () => {
      if (spotPlayerStore.isPlaying && videoRef.current) {
        videoRef.current
          .play()
          .then(() => {
            console.debug('playing');
          })
          .catch((e) => {
            console.error(e);
            spotPlayerStore.setIsPlaying(false);
            const onClick = () => {
              spotPlayerStore.setIsPlaying(true);
              document.removeEventListener('click', onClick);
            };
            document.addEventListener('click', onClick);
          });
      }
    };
    checkReady().then((isReady) => {
      if (!isReady) {
        setIsProcessing(true);
        setPrevIsProcessing(true);
        const int = setInterval(() => {
          checkReady().then((r) => {
            if (r) {
              setIsProcessing(false);
              clearInterval(int);
            }
          });
        }, 5000)
      }
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported() && videoRef.current) {
          videoRef.current.addEventListener('loadeddata', () => {
            setLoaded(true);
          });
          if (streamFile) {
            const hls = new Hls({
              // not needed for small videos (we have 3 min limit and 720 quality with half kbps)
              enableWorker: false,
              // = 1MB, should be enough
              maxBufferSize: 1000 * 1000,
            });
            const url = URL.createObjectURL(base64toblob(streamFile));
            if (url && videoRef.current) {
              hls.loadSource(url);
              hls.attachMedia(videoRef.current);
              startPlaying();
              hlsRef.current = hls;
            } else {
              if (videoRef.current) {
                videoRef.current.src = videoURL;
                startPlaying();
              }
            }
          } else {
            const check = () => {
              fetch(videoURL).then((r) => {
                if (r.ok && r.status === 200) {
                  if (videoRef.current) {
                    videoRef.current.src = '';
                    setTimeout(() => {
                      videoRef.current!.src = videoURL;
                    }, 0);
                  }

                  return true;
                } else {
                  setTimeout(() => {
                    check();
                  }, 1000);
                }
              });
            };
            check();
            videoRef.current.src = videoURL;
            startPlaying();
          }
        } else {
          if (videoRef.current) {
            videoRef.current.addEventListener('loadeddata', () => {
              setLoaded(true);
            });
            videoRef.current.src = videoURL;
            startPlaying();
          }
        }
      });
    });
    return () => {
      hlsRef.current?.destroy();
    };
  }, []);

  React.useEffect(() => {
    if (spotPlayerStore.isPlaying) {
      videoRef.current
        ?.play()
        .then((r) => {
          console.log('started', r);
        })
        .catch((e) => console.error(e));
    } else {
      videoRef.current?.pause();
    }
  }, [spotPlayerStore.isPlaying]);

  React.useEffect(() => {
    const int = setInterval(() => {
      const videoTime = videoRef.current?.currentTime ?? 0;
      if (videoTime !== spotPlayerStore.time) {
        playbackTime.current = videoTime;
        spotPlayerStore.setTime(videoTime);
      }
    }, 100);
    if (videoRef.current) {
      videoRef.current.addEventListener('ended', () => {
        spotPlayerStore.onComplete();
      });
    }
    return () => clearInterval(int);
  }, []);

  React.useEffect(() => {
    if (playbackTime.current !== spotPlayerStore.time && videoRef.current) {
      videoRef.current.currentTime = spotPlayerStore.time;
    }
  }, [spotPlayerStore.time]);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = spotPlayerStore.playbackRate;
    }
  }, [spotPlayerStore.playbackRate]);

  const warnText = isProcessing ? 'You’re viewing the entire recording. The trimmed Spot is on its way.' : 'Your trimmed Spot is ready! Please reload the page.'
  return (
    <>
      {isProcessing || prevIsProcessing
       ? <div
         className="px-3 py-1 border border-gray-lighter drop-shadow-md rounded bg-active-blue flex items-center justify-between"
         style={{
           zIndex: 999,
           position: 'absolute',
           left: '50%',
           top: '-24px',
           transform: 'translate(-50%, 0)',
           fontWeight: 500
         }}
       >
         {warnText}
       </div>
       : null}
      {!isLoaded && (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-white/50">
          <img
            src={'/assets/img/videoProcessing.svg'}
            alt={'Processing video..'}
            width={75}
            className="mb-5"
          />
          <div className={'text-2xl font-bold'}>Loading Spot Recording</div>
        </div>
      )}
      <video
        ref={videoRef}
        poster={thumbnail}
        autoPlay
        className={
          'object-contain absolute top-0 left-0 w-full h-full bg-gray-lightest cursor-pointer'
        }
        onClick={() => spotPlayerStore.setIsPlaying(!spotPlayerStore.isPlaying)}
        style={{ display: isLoaded ? 'block' : 'none' }}
      />
    </>
  );
}

export default observer(SpotVideoContainer);