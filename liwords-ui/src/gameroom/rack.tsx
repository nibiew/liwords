import React, { useRef } from 'react';
import { useDrop, XYCoord } from 'react-dnd';
import {
  CrosswordGameTileValues,
  runeToValues,
} from '../constants/tile_values';
import Tile, { TILE_TYPE } from './tile';
import { isTouchDevice } from '../utils/cwgame/common';
import { useExaminableGameContextStoreContext } from '../store/store';

// const TileSpacing = 6;

const calculatePosition = (
  position: XYCoord,
  rackElement: HTMLElement,
  rackEmptyLeftElement: HTMLElement,
  rackSize: number
) => {
  const rackLeft = rackElement.getBoundingClientRect().left;
  const rackWidth = rackElement.clientWidth;
  const rackEmptyWidth = rackEmptyLeftElement.clientWidth;
  const tileSize = (rackWidth - 2 * rackEmptyWidth) / rackSize;
  const relativePosition = position.x - rackLeft;
  if (relativePosition < rackEmptyWidth) return 0;
  if (relativePosition > rackWidth - rackEmptyWidth) return rackSize;
  return Math.floor((relativePosition - rackEmptyWidth) / tileSize);
};

type Props = {
  letters: string;
  grabbable: boolean;
  onTileClick?: (idx: number) => void;
  selected?: Set<number>;
  moveRackTile: (
    indexA: number | undefined,
    indexB: number | undefined
  ) => void;
  returnToRack?: (
    rackIndex: number | undefined,
    tileIndex: number | undefined
  ) => void;
};

export const Rack = React.memo((props: Props) => {
  const {
    gameContext: examinableGameContext,
  } = useExaminableGameContextStoreContext();
  const handleDropOver = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: any, index: number) => {
    if (props.moveRackTile && e.dataTransfer.getData('rackIndex')) {
      props.moveRackTile(
        index,
        parseInt(e.dataTransfer.getData('rackIndex'), 10)
      );
    } else if (props.returnToRack && e.dataTransfer.getData('tileIndex')) {
      props.returnToRack(
        index,
        parseInt(e.dataTransfer.getData('tileIndex'), 10)
      );
    }
  };
  const [, drop] = useDrop({
    accept: TILE_TYPE,
    drop: (item: any, monitor) => {
      const clientOffset = monitor.getClientOffset();
      const rackElement = document.getElementById('rack');
      const rackEmptyElement = document.getElementById('left-empty');
      let rackPosition = 0;
      if (clientOffset && rackElement && rackEmptyElement) {
        rackPosition = calculatePosition(
          clientOffset,
          rackElement,
          rackEmptyElement,
          props.letters.length
        );
      }
      if (props.moveRackTile && item.rackIndex) {
        props.moveRackTile(rackPosition, parseInt(item.rackIndex, 10));
      }
      if (props.returnToRack && item.tileIndex) {
        props.returnToRack(rackPosition, item.tileIndex);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  });
  const rackRef = useRef(null);
  if (isTouchDevice()) {
    drop(rackRef);
  }
  const renderTiles = () => {
    const tiles = [];
    if (!props.letters || props.letters.length === 0) {
      return null;
    }

    for (let n = 0; n < props.letters.length; n += 1) {
      const rune = props.letters[n];
      tiles.push(
        <Tile
          rune={rune}
          value={runeToValues(rune, CrosswordGameTileValues)}
          lastPlayed={false}
          playerOfTile={examinableGameContext.onturn}
          key={`tile_${n}`}
          scale={false}
          selected={props.selected && props.selected.has(n)}
          grabbable={props.grabbable}
          rackIndex={n}
          returnToRack={props.returnToRack}
          moveRackTile={props.moveRackTile}
          onClick={() => {
            if (props.onTileClick) {
              props.onTileClick(n);
            }
          }}
        />
      );
    }
    return <>{tiles}</>;
  };

  return (
    <div className="rack" ref={rackRef} id="rack">
      <div
        className="empty-rack droppable"
        id="left-empty"
        onDragOver={handleDropOver}
        onDrop={(e) => {
          handleDrop(e, 0);
        }}
      />
      {renderTiles()}
      <div
        className="empty-rack droppable"
        onDragOver={handleDropOver}
        onDrop={(e) => {
          handleDrop(e, props.letters.length);
        }}
      />
    </div>
  );
});

export default Rack;
