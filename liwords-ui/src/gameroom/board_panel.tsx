import React, { useCallback, useEffect, useRef } from 'react';
import { TouchBackend } from 'react-dnd-touch-backend';
import { Button, Modal, notification, message, Tooltip } from 'antd';
import { DndProvider } from 'react-dnd';
import { ArrowDownOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import {
  isTouchDevice,
  Blank,
  uniqueTileIdx,
  EphemeralTile,
  EmptySpace,
} from '../utils/cwgame/common';
import { useMountedState } from '../utils/mounted';

import GameBoard from './board';
import { DrawingHandlersSetterContext } from './drawing';
import GameControls from './game_controls';
import { Rack } from './rack';
import { ExchangeTiles } from './exchange_tiles';
import {
  nextArrowPropertyState,
  handleKeyPress,
  handleDroppedTile,
  returnTileToRack,
  designateBlank,
} from '../utils/cwgame/tile_placement';

import {
  parseBlindfoldCoordinates,
  natoPhoneticAlphabet,
  letterPronunciations,
} from '../utils/cwgame/blindfold';

import {
  tilesetToMoveEvent,
  exchangeMoveEvent,
  passMoveEvent,
  resignMoveEvent,
  challengeMoveEvent,
} from '../utils/cwgame/game_event';
import { Board } from '../utils/cwgame/board';
import { encodeToSocketFmt } from '../utils/protobuf';
import {
  MessageType,
  MatchRequest,
  MatchUser,
} from '../gen/api/proto/realtime/realtime_pb';
import {
  useExaminableGameContextStoreContext,
  useExaminableGameEndMessageStoreContext,
  useExaminableTimerStoreContext,
  useExamineStoreContext,
  useGameContextStoreContext,
  useTentativeTileContext,
  useTimerStoreContext,
} from '../store/store';
import { BlankSelector } from './blank_selector';
import { GameEndMessage } from './game_end_message';
import { PlayerMetadata, GCGResponse, ChallengeRule } from './game_info';
import {
  GameEvent,
  PlayState,
} from '../gen/macondo/api/proto/macondo/macondo_pb';
import { toAPIUrl } from '../api/api';
import { TilePreview } from './tile';

// The frame atop is 24 height
// The frames on the sides are 24 in width, surrounded by a 14 pix gutter
const EnterKey = 'Enter';
const colors = require('../base.scss');

type Props = {
  username: string;
  currentRack: string;
  events: Array<GameEvent>;
  gameID: string;
  challengeRule: ChallengeRule;
  board: Board;
  sendSocketMsg: (msg: Uint8Array) => void;
  gameDone: boolean;
  playerMeta: Array<PlayerMetadata>;
  tournamentSlug?: string;
  tournamentID?: string;
  tournamentPairedMode?: boolean;
  lexicon: string;
  handleAcceptRematch: (() => void) | null;
  handleSetHover?: (
    x: number,
    y: number,
    words: Array<string> | undefined
  ) => void;
  handleUnsetHover?: () => void;
  definitionPopover?:
    | { x: number; y: number; content: React.ReactNode }
    | undefined;
};

const shuffleString = (a: string): string => {
  const alist = a.split('');
  const n = a.length;

  let somethingChanged = false;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    if (alist[i] !== alist[j]) {
      somethingChanged = true;
      const tmp = alist[i];
      alist[i] = alist[j];
      alist[j] = tmp;
    }
  }

  if (!somethingChanged) {
    // Let's change something if possible.
    const j = Math.floor(Math.random() * n);
    const x = [];
    for (let i = 0; i < n; ++i) {
      if (alist[i] !== alist[j]) {
        x.push(i);
      }
    }

    if (x.length > 0) {
      const i = x[Math.floor(Math.random() * x.length)];
      const tmp = alist[i];
      alist[i] = alist[j];
      alist[j] = tmp;
    }
  }

  return alist.join('');
};

const gcgExport = (gameID: string, playerMeta: Array<PlayerMetadata>) => {
  axios
    .post<GCGResponse>(toAPIUrl('game_service.GameMetadataService', 'GetGCG'), {
      gameId: gameID,
    })
    .then((resp) => {
      const url = window.URL.createObjectURL(new Blob([resp.data.gcg]));
      const link = document.createElement('a');
      link.href = url;
      let downloadFilename = `${gameID}.gcg`;
      // TODO: allow more characters as applicable
      // Note: does not actively prevent saving .dotfiles or nul.something
      if (playerMeta.every((x) => /^[-0-9A-Za-z_.]+$/.test(x.nickname))) {
        const byStarts: Array<Array<string>> = [[], []];
        for (const x of playerMeta) {
          byStarts[+!!x.first].push(x.nickname);
        }
        downloadFilename = `${[...byStarts[1], ...byStarts[0]].join(
          '-'
        )}-${gameID}.gcg`;
      }
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.onclick = () => {
        link.remove();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 1000);
      };
      link.click();
    })
    .catch((e) => {
      if (e.response) {
        // From Twirp
        notification.warning({
          message: 'Export Error',
          description: e.response.data.msg,
          duration: 4,
        });
      } else {
        console.log(e);
      }
    });
};

export const BoardPanel = React.memo((props: Props) => {
  const { useState } = useMountedState();

  // Poka-yoke against accidentally having multiple modes active.
  const [currentMode, setCurrentMode] = useState<
    'BLANK_MODAL' | 'DRAWING_HOTKEY' | 'EXCHANGE_MODAL' | 'NORMAL' | 'BLIND'
  >('NORMAL');

  const {
    drawingCanBeEnabled,
    handleKeyDown: handleDrawingKeyDown,
  } = React.useContext(DrawingHandlersSetterContext);
  const [arrowProperties, setArrowProperties] = useState({
    row: 0,
    col: 0,
    horizontal: false,
    show: false,
  });

  const {
    gameContext: examinableGameContext,
  } = useExaminableGameContextStoreContext();
  const {
    gameEndMessage: examinableGameEndMessage,
  } = useExaminableGameEndMessageStoreContext();
  const {
    timerContext: examinableTimerContext,
  } = useExaminableTimerStoreContext();

  const { isExamining, handleExamineStart } = useExamineStoreContext();
  const { gameContext } = useGameContextStoreContext();
  const { stopClock } = useTimerStoreContext();
  const [exchangeAllowed, setexchangeAllowed] = useState(true);
  const handlePassShortcut = useRef<(() => void) | null>(null);
  const setHandlePassShortcut = useCallback((x) => {
    handlePassShortcut.current =
      typeof x === 'function' ? x(handlePassShortcut.current) : x;
  }, []);
  const handleChallengeShortcut = useRef<(() => void) | null>(null);
  const setHandleChallengeShortcut = useCallback((x) => {
    handleChallengeShortcut.current =
      typeof x === 'function' ? x(handleChallengeShortcut.current) : x;
  }, []);
  const handleNeitherShortcut = useRef<(() => void) | null>(null);
  const setHandleNeitherShortcut = useCallback((x) => {
    handleNeitherShortcut.current =
      typeof x === 'function' ? x(handleNeitherShortcut.current) : x;
  }, []);
  const boardContainer = useRef<HTMLDivElement>(null);

  const {
    displayedRack,
    setDisplayedRack,
    placedTiles,
    setPlacedTiles,
    placedTilesTempScore,
    setPlacedTilesTempScore,
    blindfoldCommand,
    setBlindfoldCommand,
    blindfoldUseNPA,
    setBlindfoldUseNPA,
  } = useTentativeTileContext();

  const observer = !props.playerMeta.some((p) => p.nickname === props.username);
  const isMyTurn = useCallback(() => {
    const iam = gameContext.nickToPlayerOrder[props.username];
    return iam && iam === `p${examinableGameContext.onturn}`;
  }, [
    gameContext.nickToPlayerOrder,
    props.username,
    examinableGameContext.onturn,
  ]);

  const { board, gameID, playerMeta, sendSocketMsg, username } = props;

  const makeMove = useCallback(
    (move: string, addl?: string) => {
      if (isExamining) return;
      let moveEvt;
      if (move !== 'resign' && !isMyTurn()) {
        console.log(
          'off turn move attempts',
          gameContext.nickToPlayerOrder,
          username,
          examinableGameContext.onturn
        );
        // It is not my turn. Ignore this event.
        message.warn({
          content: 'It is not your turn.',
          className: 'board-hud-message',
          key: 'board-messages',
          duration: 1.5,
        });
        return;
      }
      console.log(
        'making move',
        gameContext.nickToPlayerOrder,
        username,
        examinableGameContext.onturn
      );
      switch (move) {
        case 'exchange':
          moveEvt = exchangeMoveEvent(addl!, gameID);
          break;
        case 'pass':
          moveEvt = passMoveEvent(gameID);
          break;
        case 'resign':
          moveEvt = resignMoveEvent(gameID);
          break;
        case 'challenge':
          moveEvt = challengeMoveEvent(gameID);
          break;
        case 'commit':
          moveEvt = tilesetToMoveEvent(placedTiles, board, gameID);
          if (!moveEvt) {
            // this is an invalid play
            return;
          }
          break;
      }
      if (!moveEvt) {
        return;
      }
      sendSocketMsg(
        encodeToSocketFmt(
          MessageType.CLIENT_GAMEPLAY_EVENT,
          moveEvt.serializeBinary()
        )
      );
      // Don't stop the clock; the next user event to come in will change the
      // clock over.
      // stopClock();
      if (boardContainer.current) {
        // Reenable keyboard shortcut after passing with 22.
        boardContainer.current.focus();
      }
    },
    [
      gameContext.nickToPlayerOrder,
      examinableGameContext.onturn,
      isExamining,
      isMyTurn,
      placedTiles,
      board,
      gameID,
      sendSocketMsg,
      username,
    ]
  );

  const recallTiles = useCallback(() => {
    if (arrowProperties.show) {
      let { row, col, horizontal } = arrowProperties;
      const matchesLocation = ({
        row: tentativeRow,
        col: tentativeCol,
      }: {
        row: number;
        col: number;
      }) => row === tentativeRow && col === tentativeCol;
      if (
        horizontal &&
        row >= 0 &&
        row < props.board.dim &&
        col > 0 &&
        col <= props.board.dim
      ) {
        // Inefficient way to get around TypeScript restriction.
        const placedTilesArray = Array.from(placedTiles);
        let best = col;
        while (col > 0) {
          --col;
          if (props.board.letters[row * props.board.dim + col] !== EmptySpace) {
            // continue
          } else if (placedTilesArray.some(matchesLocation)) {
            best = col;
          } else {
            break;
          }
        }
        if (best !== arrowProperties.col) {
          setArrowProperties({ ...arrowProperties, col: best });
        }
      } else if (
        !horizontal &&
        col >= 0 &&
        col < props.board.dim &&
        row > 0 &&
        row <= props.board.dim
      ) {
        // Inefficient way to get around TypeScript restriction.
        const placedTilesArray = Array.from(placedTiles);
        let best = row;
        while (row > 0) {
          --row;
          if (props.board.letters[row * props.board.dim + col] !== EmptySpace) {
            // continue
          } else if (placedTilesArray.some(matchesLocation)) {
            best = row;
          } else {
            break;
          }
        }
        if (best !== arrowProperties.row) {
          setArrowProperties({ ...arrowProperties, row: best });
        }
      }
    }

    setPlacedTilesTempScore(0);
    setPlacedTiles(new Set<EphemeralTile>());
    setDisplayedRack(props.currentRack);
  }, [
    arrowProperties,
    placedTiles,
    props.board.dim,
    props.board.letters,
    props.currentRack,
    setPlacedTilesTempScore,
    setPlacedTiles,
    setDisplayedRack,
  ]);

  const shuffleTiles = useCallback(() => {
    setDisplayedRack(shuffleString(displayedRack));
  }, [setDisplayedRack, displayedRack]);

  const lastLettersRef = useRef<string>();
  const readOnlyEffectDependenciesRef = useRef<{
    displayedRack: string;
    isMyTurn: () => boolean;
    placedTiles: Set<EphemeralTile>;
    dim: number;
    arrowProperties: {
      row: number;
      col: number;
      horizontal: boolean;
      show: boolean;
    };
  }>();
  readOnlyEffectDependenciesRef.current = {
    displayedRack,
    isMyTurn,
    placedTiles,
    dim: props.board.dim,
    arrowProperties,
  };

  // Need to sync state to props here whenever the board changes.
  useEffect(() => {
    let fullReset = false;
    const lastLetters = lastLettersRef.current;
    const dep = readOnlyEffectDependenciesRef.current!;
    if (lastLetters === undefined) {
      // First load.
      fullReset = true;
    } else if (
      props.currentRack &&
      !dep.displayedRack &&
      !dep.placedTiles.size
    ) {
      // First load after receiving rack.
      fullReset = true;
    } else if (isExamining) {
      // Prevent stuck tiles.
      fullReset = true;
    } else if (!dep.isMyTurn()) {
      // Opponent's turn means we have just made a move. (Assumption: there are only two players.)
      fullReset = true;
    } else {
      // Opponent just did something. Check if it affects any premove.
      // TODO: revisit when supporting non-square boards.
      const letterAt = (row: number, col: number, letters: string) =>
        row < 0 || row >= dep.dim || col < 0 || col >= dep.dim
          ? null
          : letters[row * dep.dim + col];
      const letterChanged = (row: number, col: number) =>
        letterAt(row, col, lastLetters) !==
        letterAt(row, col, props.board.letters);
      const hookChanged = (
        row: number,
        col: number,
        drow: number,
        dcol: number
      ) => {
        while (true) {
          row += drow;
          col += dcol;
          if (letterChanged(row, col)) return true;
          const letter = letterAt(row, col, props.board.letters);
          if (letter === null || letter === EmptySpace) {
            return false;
          }
        }
      };
      const placedTileAffected = (row: number, col: number) =>
        letterChanged(row, col) ||
        hookChanged(row, col, -1, 0) ||
        hookChanged(row, col, +1, 0) ||
        hookChanged(row, col, 0, -1) ||
        hookChanged(row, col, 0, +1);
      // If no tiles have been placed, but placement arrow is shown,
      // reset based on if that position is affected.
      // This avoids having the placement arrow behind a tile.
      if (
        (dep.placedTiles.size === 0 && dep.arrowProperties.show
          ? [dep.arrowProperties as { row: number; col: number }]
          : Array.from(dep.placedTiles)
        ).some(({ row, col }) => placedTileAffected(row, col))
      ) {
        fullReset = true;
      }
    }
    if (fullReset) {
      setDisplayedRack(props.currentRack);
      setPlacedTiles(new Set<EphemeralTile>());
      setPlacedTilesTempScore(0);
      setArrowProperties({ row: 0, col: 0, horizontal: false, show: false });
    }
    lastLettersRef.current = props.board.letters;
  }, [
    isExamining,
    props.board.letters,
    props.currentRack,
    setDisplayedRack,
    setPlacedTiles,
    setPlacedTilesTempScore,
  ]);

  useEffect(() => {
    // Stop the clock if we unload the board panel.
    return () => {
      stopClock();
    };
  }, [stopClock]);

  useEffect(() => {
    const bag = { ...gameContext.pool };
    for (let i = 0; i < props.currentRack.length; i += 1) {
      bag[props.currentRack[i]] -= 1;
    }
    const tilesRemaining =
      Object.values(bag).reduce((acc, cur) => {
        return acc + cur;
      }, 0) - 7;
    // Subtract 7 for opponent rack, won't matter when the
    // rack is smaller than that because past the threshold by then
    setexchangeAllowed(tilesRemaining >= 7);
  }, [gameContext.pool, props.currentRack]);
  useEffect(() => {
    if (
      examinableGameContext.playState === PlayState.WAITING_FOR_FINAL_PASS &&
      isMyTurn()
    ) {
      const finalAction = (
        <>
          Your opponent has played their final tiles. You must{' '}
          <span
            className="message-action"
            onClick={() => makeMove('pass')}
            role="button"
          >
            pass
          </span>{' '}
          or{' '}
          <span
            className="message-action"
            role="button"
            onClick={() => makeMove('challenge')}
          >
            challenge
          </span>
          .
        </>
      );

      message.info(
        {
          content: finalAction,
          className: 'board-hud-message',
          key: 'board-messages',
        },
        15
      );
    }
  }, [examinableGameContext.playState, isMyTurn, makeMove]);

  useEffect(() => {
    if (!props.events.length) {
      return;
    }
    const evt = props.events[props.events.length - 1];
    if (evt.getNickname() === props.username) {
      return;
    }
    let boardMessage = null;
    switch (evt.getType()) {
      case GameEvent.Type.PASS:
        boardMessage = `${evt.getNickname()} passed`;
        break;
      case GameEvent.Type.EXCHANGE:
        boardMessage = `${evt.getNickname()} exchanged ${evt.getExchanged()}`;
        break;
    }
    if (boardMessage) {
      message.info(
        {
          content: boardMessage,
          className: 'board-hud-message',
          key: 'board-messages',
        },
        3,
        undefined
      );
    }
  }, [props.events, props.username]);
  const squareClicked = useCallback(
    (row: number, col: number) => {
      if (props.board.letterAt(row, col) !== EmptySpace) {
        // If there is a tile on this square, ignore the click.
        return;
      }
      setArrowProperties(nextArrowPropertyState(arrowProperties, row, col));
      props.handleUnsetHover?.();
    },
    [arrowProperties, props.board, props.handleUnsetHover]
  );
  const keydown = useCallback(
    (evt: React.KeyboardEvent) => {
      if (evt.ctrlKey || evt.altKey || evt.metaKey) {
        // Alt+3 should not challenge. Ignore Ctrl, Alt/Opt, and Win/Cmd.
        return;
      }
      let { key } = evt;
      // Neutralize caps lock to prevent accidental blank usage.
      if (key.length === 1) {
        if (!evt.shiftKey && key >= 'A' && key <= 'Z') {
          // Without shift, can only type lowercase.
          key = key.toLowerCase();
        } else if (evt.shiftKey && key >= 'a' && key <= 'z') {
          // With shift, can only type uppercase.
          key = key.toUpperCase();
        }
      }

      if (currentMode === 'BLIND') {
        const PlayerScoresAndTimes = (): [
          string,
          number,
          string,
          string,
          number,
          string
        ] => {
          const timepenalty = (time: number) => {
            // Calculate a timepenalty for speech purposes only. The backend will
            // also properly calculate this.

            if (time >= 0) {
              return 0;
            }

            const minsOvertime = Math.ceil(Math.abs(time) / 60000);
            return minsOvertime * 10;
          };

          let p0 = gameContext.players[0];
          let p1 = gameContext.players[1];

          let p0Time = examinableTimerContext.p0;
          let p1Time = examinableTimerContext.p1;

          if (props.playerMeta[0].user_id === p1.userID) {
            [p0, p1] = [p1, p0];
            [p0Time, p1Time] = [p1Time, p0Time];
          }

          const playing =
            examinableGameContext.playState !== PlayState.GAME_OVER;
          const applyTimePenalty = !isExamining && playing;
          let p0Score = p0?.score ?? 0;
          if (applyTimePenalty) p0Score -= timepenalty(p0Time);
          let p1Score = p1?.score ?? 0;
          if (applyTimePenalty) p1Score -= timepenalty(p1Time);

          // Always list the player scores and times first
          if (props.playerMeta[1].nickname === props.username) {
            return [
              'you',
              p1Score,
              playerTimeToText(p1Time),
              'opponent',
              p0Score,
              playerTimeToText(p0Time),
            ];
          }
          return [
            'you',
            p0Score,
            playerTimeToText(p0Time),
            'opponent',
            p1Score,
            playerTimeToText(p1Time),
          ];
        };

        const say = (text: string, moreText: string) => {
          const speech = new SpeechSynthesisUtterance(text);
          const lang = 'en-US';
          const rate = 0.8;
          speech.lang = lang;
          speech.rate = rate;
          window.speechSynthesis.cancel();
          speech.onend = () => {
            if (moreText !== '') {
              const moreSpeech = new SpeechSynthesisUtterance(moreText);
              moreSpeech.lang = lang;
              moreSpeech.rate = rate;
              window.speechSynthesis.cancel();
              speechSynthesis.speak(moreSpeech);
            }
          };
          window.speechSynthesis.speak(speech);
        };

        const wordToSayString = (word: string): string => {
          let speech = '';
          let currentNumber = '';
          for (let i = 0; i < word.length; i++) {
            const natoWord = natoPhoneticAlphabet.get(word[i].toUpperCase());
            if (natoWord !== undefined) {
              // Single letters in their own sentences are usually
              // fairly understandable when spoken by TTS. In some cases
              // it is unclear and using the NATO Phonetic Alphabet
              // will remove the ambiguity.
              if (word[i] >= 'a' && word[i] <= 'z') {
                speech += 'blank, ';
              }
              if (blindfoldUseNPA) {
                speech += natoWord + ', ';
              } else {
                const pword = letterPronunciations.get(word[i].toUpperCase());
                speech += pword + ', ';
              }
            } else if (word[i] === '?') {
              speech += 'blank, ';
            } else {
              // It's a number
              let middleOfNumber = false;
              currentNumber += word[i];
              if (i + 1 < word.length) {
                const natoNextWord = natoPhoneticAlphabet.get(
                  word[i + 1].toUpperCase()
                );
                if (natoNextWord === undefined) {
                  middleOfNumber = true;
                }
              }
              if (!middleOfNumber) {
                speech += currentNumber + '. ';
                currentNumber = '';
              }
            }
          }
          return speech;
        };

        const sayGameEvent = (ge: GameEvent) => {
          const type = ge.getType();
          let nickname = 'opponent.';
          if (ge.getNickname() === props.username) {
            nickname = 'you.';
          }
          const playedTiles = ge.getPlayedTiles();
          const mainWord = ge.getWordsFormedList()[0];
          let blankAwareWord = '';
          for (let i = 0; i < playedTiles.length; i++) {
            const tile = playedTiles[i];
            if (tile >= 'a' && tile <= 'z') {
              blankAwareWord += tile;
            } else {
              blankAwareWord += mainWord[i];
            }
          }
          if (type === GameEvent.Type.TILE_PLACEMENT_MOVE) {
            say(
              nickname + ' ' + wordToSayString(ge.getPosition()),
              wordToSayString(blankAwareWord) + ' ' + ge.getScore().toString()
            );
          } else if (type === GameEvent.Type.PHONY_TILES_RETURNED) {
            say(nickname + ' lost challenge', '');
          } else if (type === GameEvent.Type.EXCHANGE) {
            say(nickname + ' exchanged ' + ge.getExchanged(), '');
          } else if (type === GameEvent.Type.PASS) {
            say(nickname + ' passed', '');
          } else if (type === GameEvent.Type.CHALLENGE) {
            say(nickname + ' challenged', '');
          } else if (type === GameEvent.Type.CHALLENGE_BONUS) {
            say(nickname + ' challenge bonus', '');
          } else {
            // This is a bum way to deal with all other events
            // but I am holding out for a better solution to saying events altogether
            say(nickname + ' 5 point challenge or outplay', '');
          }
        };

        const playerTimeToText = (ms: number): string => {
          const neg = ms < 0;
          // eslint-disable-next-line no-param-reassign
          const absms = Math.abs(ms);
          // const mins = Math.floor(ms / 60000);
          let totalSecs;
          if (!neg) {
            totalSecs = Math.ceil(absms / 1000);
          } else {
            totalSecs = Math.floor(absms / 1000);
          }
          const secs = totalSecs % 60;
          const mins = Math.floor(totalSecs / 60);

          let negative = '';
          if (neg) {
            negative = 'negative ';
          }
          return (
            negative +
            mins.toString() +
            ' minutes and ' +
            secs.toString() +
            ' seconds'
          );
        };

        let newBlindfoldCommand = blindfoldCommand;
        if (key === EnterKey) {
          // There is a better way to do this
          // This should be done like the Scorecards
          // are. It should access the Scorecard info somehow
          // but I is of the not knowing.
          if (blindfoldCommand.toUpperCase() === 'P') {
            if (gameContext.turns.length < 2) {
              say('no previous play', '');
            } else {
              sayGameEvent(gameContext.turns[gameContext.turns.length - 2]);
            }
          } else if (blindfoldCommand.toUpperCase() === 'C') {
            if (gameContext.turns.length < 1) {
              say('no current play', '');
            } else {
              sayGameEvent(gameContext.turns[gameContext.turns.length - 1]);
            }
          } else if (blindfoldCommand.toUpperCase() === 'S') {
            const [, p0Score, , , p1Score] = PlayerScoresAndTimes();
            const scoresay = `${p0Score} to ${p1Score}`;
            say(scoresay, '');
          } else if (
            blindfoldCommand.toUpperCase() === 'E' &&
            exchangeAllowed &&
            !props.gameDone
          ) {
            evt.preventDefault();
            if (handleNeitherShortcut.current) handleNeitherShortcut.current();
            setCurrentMode('EXCHANGE_MODAL');
            setBlindfoldCommand('');
            say('exchange modal opened', '');
            return;
          } else if (
            blindfoldCommand.toUpperCase() === 'PASS' &&
            !props.gameDone
          ) {
            makeMove('pass');
            setCurrentMode('NORMAL');
          } else if (
            blindfoldCommand.toUpperCase() === 'CHAL' &&
            !props.gameDone
          ) {
            makeMove('challenge');
            setCurrentMode('NORMAL');
            return;
          } else if (blindfoldCommand.toUpperCase() === 'T') {
            const [, , p0Time, , , p1Time] = PlayerScoresAndTimes();
            const timesay = `${p0Time} to ${p1Time}.`;
            say(timesay, '');
          } else if (blindfoldCommand.toUpperCase() === 'R') {
            say(wordToSayString(props.currentRack), '');
          } else if (blindfoldCommand.toUpperCase() === 'B') {
            const bag = { ...gameContext.pool };
            for (let i = 0; i < props.currentRack.length; i += 1) {
              bag[props.currentRack[i]] -= 1;
            }
            let numTilesRemaining = 0;
            let tilesRemaining = '';
            let blankString = ' ';
            for (const [key, value] of Object.entries(bag)) {
              const letter = key + '. ';
              if (value > 0) {
                numTilesRemaining += value;
                if (key === '?') {
                  blankString = value + ', blank';
                } else {
                  tilesRemaining += value + ', ' + letter;
                }
              }
            }
            say(
              numTilesRemaining +
                ' tiles unseen, ' +
                wordToSayString(tilesRemaining) +
                blankString,
              ''
            );
          } else if (
            blindfoldCommand.charAt(0).toUpperCase() === 'B' &&
            blindfoldCommand.length === 2 &&
            blindfoldCommand.charAt(1).match(/[a-z.]/i)
          ) {
            const bag = { ...gameContext.pool };
            for (let i = 0; i < props.currentRack.length; i += 1) {
              bag[props.currentRack[i]] -= 1;
            }
            let tile = blindfoldCommand.charAt(1).toUpperCase();
            let numTiles = bag[tile];
            if (tile === '.') {
              tile = '?';
              numTiles = bag[tile];
              say(numTiles + ', blank', '');
            } else {
              say(wordToSayString(numTiles + ', ' + tile), '');
            }
          } else if (blindfoldCommand.toUpperCase() === 'N') {
            setBlindfoldUseNPA(!blindfoldUseNPA);
            say(
              'NATO Phonetic Alphabet is ' +
                (!blindfoldUseNPA ? ' enabled.' : ' disabled.'),
              ''
            );
          } else if (blindfoldCommand.toUpperCase() === 'W') {
            if (isMyTurn()) {
              say('It is your turn.', '');
            } else {
              say("It is your opponent's turn", '');
            }
          } else if (blindfoldCommand.toUpperCase() === 'L') {
            say(
              'B for bag. C for current play. ' +
                'E for exchange. N for NATO pronunciations. ' +
                'P for the previous play. R for rack. ' +
                'S for score. T for time. W for turn. ' +
                'P, A, S, S, for pass. C, H, A, L, for challenge.',
              ''
            );
          } else {
            const blindfoldCoordinates = parseBlindfoldCoordinates(
              blindfoldCommand
            );
            if (blindfoldCoordinates !== undefined) {
              // Valid coordinates, place the arrow
              say(wordToSayString(blindfoldCommand), '');
              const board = { ...gameContext.board };
              const existingTile = board.letters[
                blindfoldCoordinates.row * 15 + blindfoldCoordinates.col
              ].trim();
              if (!existingTile) {
                setArrowProperties({
                  row: blindfoldCoordinates.row,
                  col: blindfoldCoordinates.col,
                  horizontal: blindfoldCoordinates.horizontal,
                  show: true,
                });
              }
            } else {
              console.log('invalid command: ', blindfoldCommand);
              say('invalid command', '');
            }
          }

          newBlindfoldCommand = '';
          setCurrentMode('NORMAL');
        } else {
          newBlindfoldCommand = blindfoldCommand + key.toUpperCase();
        }
        setBlindfoldCommand(newBlindfoldCommand);
      } else if (currentMode === 'NORMAL') {
        if (
          key.toUpperCase() === ';' &&
          localStorage?.getItem('enableBlindfoldMode') === 'true'
        ) {
          evt.preventDefault();
          if (handleNeitherShortcut.current) handleNeitherShortcut.current();
          setCurrentMode('BLIND');
          return;
        }
        if (isMyTurn() && !props.gameDone) {
          if (key === '2') {
            evt.preventDefault();
            if (handlePassShortcut.current) handlePassShortcut.current();
            return;
          }
          if (key === '3') {
            evt.preventDefault();
            if (handleChallengeShortcut.current)
              handleChallengeShortcut.current();
            return;
          }
          if (key === '4' && exchangeAllowed) {
            evt.preventDefault();
            if (handleNeitherShortcut.current) handleNeitherShortcut.current();
            setCurrentMode('EXCHANGE_MODAL');
            return;
          }
          if (key === '$' && exchangeAllowed) {
            evt.preventDefault();
            makeMove('exchange', props.currentRack);
            return;
          }
        }
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          evt.preventDefault();
          setArrowProperties({
            ...arrowProperties,
            horizontal: !arrowProperties.horizontal,
          });
          return;
        }
        if (key === 'ArrowDown') {
          evt.preventDefault();
          recallTiles();
          return;
        }
        if (key === 'ArrowUp') {
          evt.preventDefault();
          shuffleTiles();
          return;
        }
        if (key === EnterKey) {
          evt.preventDefault();
          makeMove('commit');
          return;
        }
        if (key === '?') {
          return;
        }
        // This should return a new set of arrow properties, and also set
        // some state further up (the tiles layout with a "just played" type
        // marker)
        const handlerReturn = handleKeyPress(
          arrowProperties,
          props.board,
          key,
          displayedRack,
          placedTiles
        );

        if (handlerReturn === null) {
          return;
        }
        evt.preventDefault();
        setDisplayedRack(handlerReturn.newDisplayedRack);
        setArrowProperties(handlerReturn.newArrow);
        setPlacedTiles(handlerReturn.newPlacedTiles);
        setPlacedTilesTempScore(handlerReturn.playScore);
      }
    },
    [
      arrowProperties,
      blindfoldCommand,
      blindfoldUseNPA,
      gameContext.pool,
      gameContext.board,
      examinableGameContext.playState,
      examinableTimerContext.p0,
      examinableTimerContext.p1,
      gameContext.players,
      gameContext.turns,
      isExamining,
      props.playerMeta,
      props.username,
      currentMode,
      displayedRack,
      exchangeAllowed,
      setDisplayedRack,
      setPlacedTiles,
      setPlacedTilesTempScore,
      setBlindfoldCommand,
      setBlindfoldUseNPA,
      isMyTurn,
      makeMove,
      placedTiles,
      props.board,
      props.currentRack,
      props.gameDone,
      recallTiles,
      shuffleTiles,
    ]
  );

  const handleTileDrop = useCallback(
    (row: number, col: number, rackIndex = -1, tileIndex = -1) => {
      const handlerReturn = handleDroppedTile(
        row,
        col,
        props.board,
        displayedRack,
        placedTiles,
        rackIndex,
        tileIndex
      );
      if (handlerReturn === null) {
        return;
      }
      setDisplayedRack(handlerReturn.newDisplayedRack);
      setPlacedTiles(handlerReturn.newPlacedTiles);
      setPlacedTilesTempScore(handlerReturn.playScore);
      setArrowProperties({ row: 0, col: 0, horizontal: false, show: false });
      if (handlerReturn.isUndesignated) {
        setCurrentMode('BLANK_MODAL');
      }
    },
    [
      displayedRack,
      placedTiles,
      props.board,
      setDisplayedRack,
      setPlacedTilesTempScore,
      setPlacedTiles,
    ]
  );

  const clickToBoard = useCallback(
    (rackIndex: number) => {
      if (
        !arrowProperties.show ||
        arrowProperties.row >= props.board.dim ||
        arrowProperties.col >= props.board.dim
      ) {
        return null;
      }
      const handlerReturn = handleDroppedTile(
        arrowProperties.row,
        arrowProperties.col,
        props.board,
        displayedRack,
        placedTiles,
        rackIndex,
        uniqueTileIdx(arrowProperties.row, arrowProperties.col)
      );
      if (handlerReturn === null) {
        return;
      }
      setDisplayedRack(handlerReturn.newDisplayedRack);
      setPlacedTiles(handlerReturn.newPlacedTiles);
      setPlacedTilesTempScore(handlerReturn.playScore);
      if (handlerReturn.isUndesignated) {
        setCurrentMode('BLANK_MODAL');
      }
      let newrow = arrowProperties.row;
      let newcol = arrowProperties.col;

      if (arrowProperties.horizontal) {
        do {
          newcol += 1;
        } while (
          newcol < props.board.dim &&
          newcol >= 0 &&
          props.board.letterAt(newrow, newcol) !== EmptySpace
        );
      } else {
        do {
          newrow += 1;
        } while (
          newrow < props.board.dim &&
          newrow >= 0 &&
          props.board.letterAt(newrow, newcol) !== EmptySpace
        );
      }
      setArrowProperties({
        col: newcol,
        horizontal: arrowProperties.horizontal,
        show: !(newcol === props.board.dim || newrow === props.board.dim),
        row: newrow,
      });
    },
    [
      arrowProperties.col,
      arrowProperties.horizontal,
      arrowProperties.row,
      arrowProperties.show,
      displayedRack,
      placedTiles,
      setDisplayedRack,
      setPlacedTiles,
      setPlacedTilesTempScore,
      props.board,
    ]
  );

  const handleBoardTileClick = useCallback((rune: string) => {
    if (rune === Blank) {
      setCurrentMode('BLANK_MODAL');
    }
  }, []);

  const handleBlankSelection = useCallback(
    (rune: string) => {
      const handlerReturn = designateBlank(
        props.board,
        placedTiles,
        displayedRack,
        rune
      );
      if (handlerReturn === null) {
        return;
      }
      setCurrentMode('NORMAL');
      setPlacedTiles(handlerReturn.newPlacedTiles);
      setPlacedTilesTempScore(handlerReturn.playScore);
    },
    [
      displayedRack,
      placedTiles,
      props.board,
      setPlacedTiles,
      setPlacedTilesTempScore,
    ]
  );

  const handleBlankModalCancel = useCallback(() => {
    setCurrentMode('NORMAL');
  }, []);

  const returnToRack = useCallback(
    (rackIndex: number | undefined, tileIndex: number | undefined) => {
      const handlerReturn = returnTileToRack(
        props.board,
        displayedRack,
        placedTiles,
        rackIndex,
        tileIndex
      );
      if (handlerReturn === null) {
        return;
      }
      setDisplayedRack(handlerReturn.newDisplayedRack);
      setPlacedTiles(handlerReturn.newPlacedTiles);
      setPlacedTilesTempScore(handlerReturn.playScore);
      setArrowProperties({ row: 0, col: 0, horizontal: false, show: false });
    },
    [
      displayedRack,
      placedTiles,
      setPlacedTilesTempScore,
      setDisplayedRack,
      setPlacedTiles,
      props.board,
    ]
  );

  const moveRackTile = useCallback(
    (newIndex: number | undefined, oldIndex: number | undefined) => {
      if (typeof newIndex === 'number' && typeof oldIndex === 'number') {
        const newRack = displayedRack.split('');
        newRack.splice(oldIndex, 1);
        newRack.splice(newIndex, 0, displayedRack[oldIndex]);
        setDisplayedRack(newRack.join(''));
      }
    },
    [displayedRack, setDisplayedRack]
  );

  const showExchangeModal = useCallback(() => {
    setCurrentMode('EXCHANGE_MODAL');
  }, []);

  const handleExchangeModalOk = useCallback(
    (exchangedTiles: string) => {
      setCurrentMode('NORMAL');
      makeMove('exchange', exchangedTiles);
    },
    [makeMove]
  );

  const rematch = useCallback(() => {
    const evt = new MatchRequest();
    const receiver = new MatchUser();

    let opp = '';
    playerMeta.forEach((p) => {
      if (!(p.nickname === username)) {
        opp = p.nickname;
      }
    });

    if (observer) {
      return;
    }

    receiver.setDisplayName(opp);
    evt.setReceivingUser(receiver);
    evt.setRematchFor(gameID);
    if (props.tournamentID) {
      evt.setTournamentId(props.tournamentID);
    }
    sendSocketMsg(
      encodeToSocketFmt(MessageType.MATCH_REQUEST, evt.serializeBinary())
    );

    notification.info({
      message: 'Rematch',
      description: `Sent rematch request to ${opp}`,
    });
    console.log('rematching');
  }, [
    observer,
    gameID,
    playerMeta,
    sendSocketMsg,
    username,
    props.tournamentID,
  ]);

  const handleKeyDown = useCallback(
    (e) => {
      if (drawingCanBeEnabled) {
        // To activate a drawing hotkey, type 0, then the hotkey.
        if (currentMode === 'NORMAL' || currentMode === 'DRAWING_HOTKEY') {
          if (e.ctrlKey || e.altKey || e.metaKey) {
            // Do not prevent Ctrl+0/Cmd+0.
          } else {
            if (currentMode === 'DRAWING_HOTKEY') {
              e.preventDefault();
              setCurrentMode('NORMAL');
              handleDrawingKeyDown(e);
              return;
            }
            if (e.key === '0') {
              e.preventDefault();
              setCurrentMode('DRAWING_HOTKEY');
              console.log(
                'You pressed 0. Now press one of these keys:' +
                  '\n0 = Toggle drawing' +
                  '\nU = Undo' +
                  '\nW = Wipe' +
                  '\nF = Freehand mode' +
                  '\nL = Line mode' +
                  '\nA = Arrow mode' +
                  '\nQ = Quadrangle mode' +
                  '\nC = Circle mode' +
                  '\nS = Snap (does not affect freehand)' +
                  '\nD = Do not snap' +
                  '\nR = Red pen' +
                  '\nG = Green pen' +
                  '\nB = Blue pen' +
                  '\nY = Yellow pen' +
                  '\nE = Eraser'
              );
              return;
            }
          }
        }
      }
      if (e.ctrlKey || e.altKey || e.metaKey) {
        // If a modifier key is held, never mind.
      } else {
        // prevent page from scrolling
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ') {
          e.preventDefault();
        }
      }
      keydown(e);
    },
    [currentMode, drawingCanBeEnabled, handleDrawingKeyDown, keydown]
  );
  // Just put this in onKeyPress to block all typeable keys so that typos from
  // placing a tile not on rack also do not trigger type-to-find on firefox.
  const preventFirefoxTypeToSearch = useCallback((e) => {
    e.preventDefault();
  }, []);
  const handlePass = useCallback(() => makeMove('pass'), [makeMove]);
  const handleResign = useCallback(() => makeMove('resign'), [makeMove]);
  const handleChallenge = useCallback(() => makeMove('challenge'), [makeMove]);
  const handleCommit = useCallback(() => makeMove('commit'), [makeMove]);
  const handleExportGCG = useCallback(
    () => gcgExport(props.gameID, props.playerMeta),
    [props.gameID, props.playerMeta]
  );
  const handleExchangeTilesCancel = useCallback(() => {
    setCurrentMode('NORMAL');
  }, []);

  const gameBoard = (
    <div
      id="board-container"
      ref={boardContainer}
      className="board-container"
      onKeyDown={handleKeyDown}
      onKeyPress={preventFirefoxTypeToSearch}
      tabIndex={-1}
      role="textbox"
    >
      <GameBoard
        gridSize={props.board.dim}
        gridLayout={props.board.gridLayout}
        handleBoardTileClick={handleBoardTileClick}
        handleTileDrop={handleTileDrop}
        tilesLayout={props.board.letters}
        lastPlayedTiles={examinableGameContext.lastPlayedTiles}
        playerOfTileAt={examinableGameContext.playerOfTileAt}
        tentativeTiles={placedTiles}
        tentativeTileScore={placedTilesTempScore}
        currentRack={props.currentRack}
        squareClicked={squareClicked}
        placementArrowProperties={arrowProperties}
        handleSetHover={props.handleSetHover}
        handleUnsetHover={props.handleUnsetHover}
        definitionPopover={props.definitionPopover}
      />
      {!examinableGameEndMessage ? (
        <div className="rack-container">
          <Tooltip
            title="Reset Rack &darr;"
            placement="bottomRight"
            mouseEnterDelay={0.1}
            mouseLeaveDelay={0.01}
            color={colors.colorPrimary}
          >
            <Button
              shape="circle"
              icon={<ArrowDownOutlined />}
              type="primary"
              onClick={recallTiles}
            />
          </Tooltip>
          <Rack
            letters={displayedRack}
            grabbable
            returnToRack={returnToRack}
            onTileClick={clickToBoard}
            moveRackTile={moveRackTile}
          />
          <Tooltip
            title="Shuffle &uarr;"
            placement="bottomLeft"
            mouseEnterDelay={0.1}
            mouseLeaveDelay={0.01}
            color={colors.colorPrimary}
          >
            <Button
              shape="circle"
              icon={<SyncOutlined />}
              type="primary"
              onClick={shuffleTiles}
              autoFocus={true}
            />
          </Tooltip>
        </div>
      ) : (
        <GameEndMessage message={examinableGameEndMessage} />
      )}
      {isTouchDevice() ? <TilePreview gridDim={props.board.dim} /> : null}
      <GameControls
        isExamining={isExamining}
        myTurn={isMyTurn()}
        finalPassOrChallenge={
          examinableGameContext.playState === PlayState.WAITING_FOR_FINAL_PASS
        }
        exchangeAllowed={exchangeAllowed}
        observer={observer}
        onRecall={recallTiles}
        showExchangeModal={showExchangeModal}
        onPass={handlePass}
        onResign={handleResign}
        onChallenge={handleChallenge}
        onCommit={handleCommit}
        onRematch={props.handleAcceptRematch ?? rematch}
        onExamine={handleExamineStart}
        onExportGCG={handleExportGCG}
        showRematch={examinableGameEndMessage !== ''}
        gameEndControls={examinableGameEndMessage !== '' || props.gameDone}
        currentRack={props.currentRack}
        tournamentSlug={props.tournamentSlug}
        tournamentPairedMode={props.tournamentPairedMode}
        lexicon={props.lexicon}
        challengeRule={props.challengeRule}
        setHandlePassShortcut={setHandlePassShortcut}
        setHandleChallengeShortcut={setHandleChallengeShortcut}
        setHandleNeitherShortcut={setHandleNeitherShortcut}
      />
      <ExchangeTiles
        rack={props.currentRack}
        modalVisible={currentMode === 'EXCHANGE_MODAL'}
        onOk={handleExchangeModalOk}
        onCancel={handleExchangeTilesCancel}
      />
      <Modal
        className="blank-modal"
        title="Designate your blank"
        visible={currentMode === 'BLANK_MODAL'}
        onCancel={handleBlankModalCancel}
        width={360}
        footer={null}
      >
        <BlankSelector handleSelection={handleBlankSelection} />
      </Modal>
    </div>
  );
  if (!isTouchDevice) {
    return gameBoard;
  }
  return <DndProvider backend={TouchBackend}>{gameBoard}</DndProvider>;
});
