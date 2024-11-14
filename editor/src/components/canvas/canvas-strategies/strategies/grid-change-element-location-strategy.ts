import type { ElementPath } from 'utopia-shared/src/types'
import { MetadataUtils } from '../../../../core/model/element-metadata-utils'
import * as EP from '../../../../core/shared/element-path'
import * as PP from '../../../../core/shared/property-path'
import type {
  ElementInstanceMetadata,
  ElementInstanceMetadataMap,
  GridContainerProperties,
  GridElementProperties,
} from '../../../../core/shared/element-template'
import { gridPositionValue, isJSXElement } from '../../../../core/shared/element-template'
import { isInfinityRectangle } from '../../../../core/shared/math-utils'
import { absolute } from '../../../../utils/utils'
import type { CanvasCommand } from '../../commands/commands'
import { reorderElement } from '../../commands/reorder-element-command'
import { showGridControls } from '../../commands/show-grid-controls-command'
import { controlsForGridPlaceholders } from '../../controls/grid-controls-for-strategies'
import type { CanvasStrategyFactory } from '../canvas-strategies'
import { onlyFitWhenDraggingThisControl } from '../canvas-strategies'
import type { InteractionCanvasState } from '../canvas-strategy-types'
import {
  emptyStrategyApplicationResult,
  getTargetPathsFromInteractionTarget,
  strategyApplicationResult,
} from '../canvas-strategy-types'
import type { DragInteractionData, InteractionSession } from '../interaction-state'
import type { GridCellGlobalFrames, SortableGridElementProperties } from './grid-helpers'
import {
  getOriginalElementGridConfiguration,
  getParentGridTemplatesFromChildMeasurements,
  gridMoveStrategiesExtraCommands,
  setGridPropsCommands,
  sortElementsByGridPosition,
} from './grid-helpers'
import { getTargetGridCellData } from '../../../inspector/grid-helpers'
import { forEachOf } from '../../../../core/shared/optics/optic-utilities'
import {
  eitherRight,
  fromField,
  fromTypeGuard,
} from '../../../../core/shared/optics/optic-creators'
import { getJSXAttributesAtPath } from '../../../..//core/shared/jsx-attribute-utils'
import { gridItemIdentifier } from '../../../editor/store/editor-state'

export const gridChangeElementLocationStrategy: CanvasStrategyFactory = (
  canvasState: InteractionCanvasState,
  interactionSession: InteractionSession | null,
) => {
  const selectedElements = getTargetPathsFromInteractionTarget(canvasState.interactionTarget)
  if (
    selectedElements.length !== 1 ||
    interactionSession == null ||
    interactionSession.interactionData.type !== 'DRAG' ||
    interactionSession.interactionData.drag == null ||
    interactionSession.activeControl.type !== 'GRID_CELL_HANDLE' ||
    interactionSession.interactionData.modifiers.alt
  ) {
    return null
  }

  const selectedElement = selectedElements[0]
  if (!MetadataUtils.isGridItem(canvasState.startingMetadata, selectedElement)) {
    return null
  }

  const selectedElementMetadata = MetadataUtils.findElementByElementPath(
    canvasState.startingMetadata,
    selectedElement,
  )
  if (
    selectedElementMetadata == null ||
    !MetadataUtils.targetRegisteredStyleControlsOrHonoursStyleProps(
      canvasState.projectContents,
      selectedElementMetadata,
      canvasState.propertyControlsInfo,
      'layout',
      ['gridRow', 'gridColumn', 'gridRowStart', 'gridColumnStart', 'gridRowEnd', 'gridColumnEnd'],
      'every',
    )
  ) {
    return null
  }

  const initialTemplates = getParentGridTemplatesFromChildMeasurements(
    selectedElementMetadata.specialSizeMeasurements,
  )
  if (initialTemplates == null) {
    return null
  }

  if (MetadataUtils.isPositionAbsolute(selectedElementMetadata)) {
    return null
  }

  return {
    id: 'grid-change-element-location-strategy',
    name: 'Change Location',
    descriptiveLabel: 'Change Location',
    icon: {
      category: 'tools',
      type: 'pointer',
    },
    controlsToRender: [
      controlsForGridPlaceholders(gridItemIdentifier(selectedElement), 'visible-only-while-active'),
    ],
    fitness: onlyFitWhenDraggingThisControl(interactionSession, 'GRID_CELL_HANDLE', 2),
    apply: () => {
      if (
        interactionSession == null ||
        interactionSession.interactionData.type !== 'DRAG' ||
        interactionSession.interactionData.drag == null ||
        interactionSession.activeControl.type !== 'GRID_CELL_HANDLE'
      ) {
        return emptyStrategyApplicationResult
      }

      const { commands, elementsToRerender } = getCommandsAndPatchForGridChangeElementLocation(
        canvasState,
        interactionSession.interactionData,
        selectedElement,
      )
      if (commands.length === 0) {
        return emptyStrategyApplicationResult
      }

      const { midInteractionCommands, onCompleteCommands } = gridMoveStrategiesExtraCommands(
        EP.parentPath(selectedElement), // TODO: don't use EP.parentPath
        initialTemplates,
      )

      return strategyApplicationResult(
        [...midInteractionCommands, ...onCompleteCommands, ...commands],
        elementsToRerender,
      )
    },
  }
}

function getCommandsAndPatchForGridChangeElementLocation(
  canvasState: InteractionCanvasState,
  interactionData: DragInteractionData,
  selectedElement: ElementPath,
): {
  commands: CanvasCommand[]
  elementsToRerender: ElementPath[]
} {
  if (interactionData.drag == null) {
    return { commands: [], elementsToRerender: [] }
  }

  const selectedElementMetadata = MetadataUtils.findElementByElementPath(
    canvasState.startingMetadata,
    selectedElement,
  )
  if (selectedElementMetadata == null) {
    return { commands: [], elementsToRerender: [] }
  }

  const { parentGridCellGlobalFrames, parentContainerGridProperties } =
    selectedElementMetadata.specialSizeMeasurements
  if (parentGridCellGlobalFrames == null) {
    return { commands: [], elementsToRerender: [] }
  }

  const commands = runGridChangeElementLocation(
    canvasState.startingMetadata,
    interactionData,
    selectedElementMetadata,
    parentGridCellGlobalFrames,
    parentContainerGridProperties,
    null,
  )

  return {
    commands: commands,
    elementsToRerender: [EP.parentPath(selectedElement), selectedElement],
  }
}

export function runGridChangeElementLocation(
  jsxMetadata: ElementInstanceMetadataMap,
  interactionData: DragInteractionData,
  selectedElementMetadata: ElementInstanceMetadata,
  gridCellGlobalFrames: GridCellGlobalFrames,
  gridTemplate: GridContainerProperties,
  newPathAfterReparent: ElementPath | null,
): CanvasCommand[] {
  if (interactionData.drag == null) {
    return []
  }

  const isReparent = newPathAfterReparent != null
  const pathForCommands = isReparent ? newPathAfterReparent : selectedElementMetadata.elementPath // when reparenting, we want to use the new path for commands

  const gridConfig = isReparent
    ? {
        originalCellBounds: { width: 1, height: 1 }, // when reparenting, we just put it in a single cell
        mouseCellPosInOriginalElement: { row: 0, column: 0 },
      }
    : getOriginalElementGridConfiguration(
        gridCellGlobalFrames,
        interactionData,
        selectedElementMetadata,
      )
  if (gridConfig == null) {
    return []
  }
  const { mouseCellPosInOriginalElement, originalCellBounds } = gridConfig

  const targetGridCellData = getTargetGridCellData(
    interactionData,
    gridCellGlobalFrames,
    mouseCellPosInOriginalElement,
  )
  if (targetGridCellData == null) {
    return []
  }
  const { targetCellCoords, targetRootCell } = targetGridCellData

  const gridProps: Partial<GridElementProperties> = {
    gridColumnStart: gridPositionValue(targetRootCell.column),
    gridColumnEnd: gridPositionValue(targetRootCell.column + originalCellBounds.width),
    gridRowStart: gridPositionValue(targetRootCell.row),
    gridRowEnd: gridPositionValue(targetRootCell.row + originalCellBounds.height),
  }

  // TODO: Remove this logic once there is a fix for the handling of the track end fields.
  let keepGridColumnEnd: boolean = true
  let keepGridRowEnd: boolean = true
  forEachOf(
    fromField<ElementInstanceMetadata, 'element'>('element')
      .compose(eitherRight())
      .compose(fromTypeGuard(isJSXElement))
      .compose(fromField('props')),
    selectedElementMetadata,
    (elementProperties) => {
      function shouldKeep(shorthandProp: 'gridColumn' | 'gridRow'): boolean {
        const longhandProp = shorthandProp === 'gridColumn' ? 'gridColumnEnd' : 'gridRowEnd'

        const shorthand = getJSXAttributesAtPath(
          elementProperties,
          PP.create('style', shorthandProp),
        )
        if (
          shorthand.attribute.type === 'ATTRIBUTE_VALUE' &&
          typeof shorthand.attribute.value === 'string' &&
          shorthand.attribute.value.includes('/')
        ) {
          return true
        }

        const longhand = getJSXAttributesAtPath(elementProperties, PP.create('style', longhandProp))
        if (longhand.attribute.type !== 'ATTRIBUTE_NOT_FOUND') {
          return true
        }

        return false
      }
      keepGridColumnEnd = shouldKeep('gridColumn')
      keepGridRowEnd = shouldKeep('gridRow')
    },
  )

  const gridCellMoveCommands = setGridPropsCommands(
    pathForCommands,
    gridTemplate,
    gridProps,
  ).filter((command) => {
    if (command.type === 'SET_PROPERTY') {
      if (PP.pathsEqual(command.property, PP.create('style', 'gridColumnEnd'))) {
        return keepGridColumnEnd
      } else if (PP.pathsEqual(command.property, PP.create('style', 'gridRowEnd'))) {
        return keepGridRowEnd
      } else {
        return true
      }
    } else {
      return true
    }
  })

  // The siblings of the grid element being moved
  const siblings = MetadataUtils.getSiblingsUnordered(
    jsxMetadata,
    newPathAfterReparent ?? selectedElementMetadata.elementPath,
  )
    .filter((s) => !EP.pathsEqual(s.elementPath, selectedElementMetadata.elementPath))
    .map(
      (s, index): SortableGridElementProperties => ({
        ...s.specialSizeMeasurements.elementGridProperties,
        index: index,
        path: s.elementPath,
      }),
    )

  // Sort the siblings and the cell under mouse ascending based on their grid coordinates, so that
  // the indexes grow left-right, top-bottom.
  const templateColumnsCount =
    gridTemplate.gridTemplateColumns?.type === 'DIMENSIONS'
      ? gridTemplate.gridTemplateColumns.dimensions.length
      : 1
  const cellsSortedByPosition = siblings
    .concat({
      ...{
        gridColumnStart: gridPositionValue(targetCellCoords.column),
        gridColumnEnd: gridPositionValue(targetCellCoords.column),
        gridRowStart: gridPositionValue(targetCellCoords.row),
        gridRowEnd: gridPositionValue(targetCellCoords.row),
      },
      path: selectedElementMetadata.elementPath,
      index: siblings.length + 1,
    })
    .sort(sortElementsByGridPosition(templateColumnsCount))

  const indexInSortedCellsForChangeLocation = cellsSortedByPosition.findIndex((s) =>
    EP.pathsEqual(selectedElementMetadata.elementPath, s.path),
  )

  const updateGridControlsCommand = showGridControls(
    'mid-interaction',
    gridItemIdentifier(selectedElementMetadata.elementPath),
    targetCellCoords,
    targetRootCell,
  )

  return [
    ...gridCellMoveCommands,
    reorderElement(
      'always',
      pathForCommands,
      absolute(Math.max(indexInSortedCellsForChangeLocation, 0)),
    ),
    updateGridControlsCommand,
  ]
}