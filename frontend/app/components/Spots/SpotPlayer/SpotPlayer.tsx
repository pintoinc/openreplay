import { Button, Card } from 'antd';
import cn from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { connect } from 'react-redux';
import { useHistory, useParams } from 'react-router-dom';

import { useStore } from 'App/mstore';
import { EscapeButton, Icon, Loader } from 'UI';

import AnimatedSVG, { ICONS } from 'Shared/AnimatedSVG/AnimatedSVG';

import {
  debounceUpdate,
  getDefaultPanelHeight,
} from '../../Session/Player/ReplayPlayer/PlayerInst';
import { SpotOverviewPanelCont } from '../../Session_/OverviewPanel/OverviewPanel';
import withPermissions from '../../hocs/withPermissions';
import SpotConsole from './components/Panels/SpotConsole';
import SpotNetwork from './components/Panels/SpotNetwork';
import SpotLocation from './components/SpotLocation';
import SpotPlayerControls from './components/SpotPlayerControls';
import SpotPlayerHeader from './components/SpotPlayerHeader';
import SpotPlayerSideBar from './components/SpotSideBar';
import SpotTimeline from './components/SpotTimeline';
import SpotVideoContainer from './components/SpotVideoContainer';
// import VideoJS from "./components/Vjs"; backup player
import { Tab } from './consts';
import spotPlayerStore, { PANELS } from './spotPlayerStore';

function SpotPlayer({ loggedIn }: { loggedIn: boolean }) {
  const defaultHeight = getDefaultPanelHeight();
  const history = useHistory();
  const [panelHeight, setPanelHeight] = React.useState(defaultHeight);
  const { spotStore } = useStore();
  const { spotId } = useParams<{ spotId: string }>();
  const [activeTab, setActiveTab] = React.useState<Tab | null>(null);

  React.useEffect(() => {
    if (spotStore.currentSpot) {
      document.title = spotStore.currentSpot.title + ' - OpenReplay'
    }
  }, [spotStore.currentSpot])
  React.useEffect(() => {
    if (!loggedIn) {
      const query = new URLSearchParams(window.location.search);
      const pubKey = query.get('pub_key');
      if (pubKey) {
        spotStore.setAccessKey(pubKey);
      } else {
        history.push('/');
      }
    }
  }, [loggedIn]);

  const handleResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelHeight;

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const diff = startHeight - deltaY;
      const max =
        diff > window.innerHeight / 1.5 ? window.innerHeight / 1.5 : diff;
      const newHeight = Math.max(50, max);
      setPanelHeight(newHeight);
      debounceUpdate(newHeight);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  React.useEffect(() => {
    spotStore.fetchSpotById(spotId).then(async (spotInst) => {
      if (spotInst.mobURL) {
        try {
          void spotStore.getPubKey(spotId);
        } catch {
          // ignore
        }
        try {
          const mobResp = await fetch(spotInst.mobURL);
          const {
            clicks = [],
            logs = [],
            network = [],
            locations = [],
            startTs = 0,
            browserVersion,
            resolution,
            platform,
          } = await mobResp.json();
          spotPlayerStore.setStartTs(startTs);
          spotPlayerStore.setDuration(spotInst.duration);
          spotPlayerStore.setDeviceData(browserVersion, resolution, platform);
          spotPlayerStore.setEvents(logs, locations, clicks, network);
        } catch (e) {
          console.error("Couldn't parse mob file", e);
        }
      }
    });

    const ev = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return false;
      }
      if (e.key === 'Escape') {
        spotPlayerStore.setIsFullScreen(false);
      }
      if (e.key === 'F') {
        spotPlayerStore.setIsFullScreen(true);
      }
      if (e.key === ' ') {
        spotPlayerStore.setIsPlaying(!spotPlayerStore.isPlaying);
      }
      if (e.key === 'ArrowDown') {
        const current = spotPlayerStore.playbackRate;
        spotPlayerStore.setPlaybackRate(Math.max(0.5, current / 2));
      }
      if (e.key === 'ArrowUp') {
        const current = spotPlayerStore.playbackRate;
        const highest = 16;
        spotPlayerStore.setPlaybackRate(Math.min(highest, current * 2));
      }
      if (e.key === 'ArrowRight') {
        spotPlayerStore.setTime(
          Math.min(
            spotPlayerStore.duration,
            spotPlayerStore.time + spotPlayerStore.skipInterval
          )
        );
      }
      if (e.key === 'ArrowLeft') {
        spotPlayerStore.setTime(
          Math.max(0, spotPlayerStore.time - spotPlayerStore.skipInterval)
        );
      }
    };

    document.addEventListener('keydown', ev);
    return () => {
      document.removeEventListener('keydown', ev);
      spotStore.clearCurrent();
      spotPlayerStore.clearData();
    };
  }, []);
  if (!spotStore.currentSpot) {
    return (
      <div
        className={
          'w-screen h-screen flex items-center justify-center flex-col gap-2'
        }
      >
        {spotStore.accessError ? (
          <>
            <div className="w-full h-full block ">
              <div className="flex bg-white border-b text-center justify-center py-4">
                <a href="https://openreplay.com/spot" target="_blank">
                  <Button
                    type="text"
                    className="orSpotBranding flex gap-1 items-center"
                    size="large"
                  >
                    <Icon name={'orSpot'} size={28} />
                    <div className="flex flex-row gap-2 items-center text-start">
                      <div className={'text-3xl font-semibold '}>Spot</div>
                      <div className={'text-disabled-text text-xs mt-3'}>
                        by OpenReplay
                      </div>
                    </div>
                  </Button>
                </a>
              </div>
              <Card className="w-1/2 mx-auto rounded-b-full shadow-sm text-center flex flex-col justify-center items-center z-50 min-h-60">
                <div className={'font-semibold text-xl'}>
                  The Spot link has expired.
                </div>
                <p className="text-lg">
                  Contact the person who shared it to re-spot.
                </p>
              </Card>
              <div className="rotate-180 -z-10 w-fit mx-auto -mt-5 hover:mt-2 transition-all ease-in-out hover:rotate-0 hover:transition-all hover:ease-in-out duration-500 hover:duration-150">
                <AnimatedSVG name={ICONS.NO_RECORDINGS} size={60} />
              </div>
            </div>
          </>
        ) : (
          <Loader />
        )}
      </div>
    );
  }

  const closeTab = () => {
    setActiveTab(null);
  };

  const onPanelClose = () => {
    spotPlayerStore.setActivePanel(null);
  };

  const isFullScreen = spotPlayerStore.isFullScreen;
  // 2nd player option
  // const base64toblob = (str: string) => {
  //   const byteCharacters = atob(str);
  //   const byteNumbers = new Array(byteCharacters.length);
  //   for (let i = 0; i < byteCharacters.length; i++) {
  //     byteNumbers[i] = byteCharacters.charCodeAt(i);
  //   }
  //   const byteArray = new Uint8Array(byteNumbers);
  //   return new Blob([byteArray]);
  // };
  //
  // const url = URL.createObjectURL(base64toblob(spotStore.currentSpot.streamFile));
  // const videoJsOptions = {
  //   autoplay: true,
  //   controls: true,
  //   responsive: false,
  //   fluid: false,
  //   fill: true,
  //   sources: [{
  //     src: url,
  //     type: 'application/x-mpegURL'
  //   }]
  // };

  return (
    <div
      className={cn(
        'w-screen h-screen flex flex-col',
        isFullScreen ? 'relative' : ''
      )}
    >
      {isFullScreen ? (
        <EscapeButton onClose={() => spotPlayerStore.setIsFullScreen(false)} />
      ) : null}
      <SpotPlayerHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        title={spotStore.currentSpot.title}
        user={spotStore.currentSpot.user}
        date={spotStore.currentSpot.createdAt}
        resolution={spotPlayerStore.resolution}
        platform={spotPlayerStore.platform}
        browserVersion={spotPlayerStore.browserVersion}
      />
      <div className={'w-full h-full flex'}>
        <div className={'w-full h-full flex flex-col justify-between'}>
          <SpotLocation />
          <div className={cn('w-full h-full', isFullScreen ? '' : 'relative')}>
            {/*<VideoJS backup player */}
            {/*  options={videoJsOptions}*/}
            {/*/>*/}
            <SpotVideoContainer
              videoURL={spotStore.currentSpot.videoURL!}
              streamFile={spotStore.currentSpot.streamFile}
              thumbnail={spotStore.currentSpot.thumbnail}
              checkReady={() => spotStore.checkIsProcessed(spotId)}
            />
          </div>
          {!isFullScreen && spotPlayerStore.activePanel ? (
            <div
              style={{
                height: panelHeight,
                maxWidth: activeTab ? 'calc(100vw - 320px)' : '100vw',
                width: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                onMouseDown={handleResize}
                className={
                  'w-full h-2 cursor-ns-resize absolute top-0 left-0 z-20'
                }
              />
              {spotPlayerStore.activePanel ? (
                <div className={'w-full h-full bg-white'}>
                  {spotPlayerStore.activePanel === PANELS.CONSOLE ? (
                    <SpotConsole onClose={onPanelClose} />
                  ) : null}
                  {spotPlayerStore.activePanel === PANELS.NETWORK ? (
                    <SpotNetwork
                      onClose={onPanelClose}
                      panelHeight={panelHeight}
                    />
                  ) : null}
                  {spotPlayerStore.activePanel === PANELS.OVERVIEW ? (
                    <SpotOverviewConnector />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <SpotTimeline />
          {isFullScreen ? null : <SpotPlayerControls />}
        </div>
        <SpotPlayerSideBar
          activeTab={activeTab}
          onClose={closeTab}
          comments={spotStore.currentSpot?.comments ?? []}
        />
      </div>
    </div>
  );
}

const SpotOverviewConnector = observer(() => {
  const endTime = spotPlayerStore.duration * 1000;
  const time = spotPlayerStore.time * 1000;
  const resourceList = spotPlayerStore.network
    .filter((r: any) => r.isRed || r.isYellow || (r.status && r.status >= 400))
    .filter((i: any) => i.type === 'xhr');
  const exceptionsList = spotPlayerStore.logs.filter(
    (l) => l.level === 'error'
  );

  const onClose = () => {
    spotPlayerStore.setActivePanel(null);
  }
  return (
    <SpotOverviewPanelCont
      exceptionsList={exceptionsList}
      resourceList={resourceList}
      spotTime={time}
      spotEndTime={endTime}
      onClose={onClose}
    />
  );
});

function mapStateToProps(state: any) {
  const userEmail = state.getIn(['user', 'account', 'name']);
  const loggedIn = !!userEmail;
  return {
    userEmail,
    loggedIn,
  };
}

export default withPermissions(['SPOT'])(
  connect(mapStateToProps)(observer(SpotPlayer))
);