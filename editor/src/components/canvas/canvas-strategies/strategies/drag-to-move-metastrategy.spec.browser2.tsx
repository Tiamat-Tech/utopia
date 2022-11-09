import { windowPoint } from '../../../../core/shared/math-utils'
import { cmdModifier, emptyModifiers } from '../../../../utils/modifiers'
import { CanvasControlsContainerID } from '../../controls/new-canvas-controls'
import { mouseClickAtPoint, mouseDragFromPointWithDelta } from '../../event-helpers.test-utils'
import { makeTestProjectCodeWithSnippet, renderTestEditorWithCode } from '../../ui-jsx.test-utils'

const TestProject1 = `
<div style={{ width: '100%', height: '100%' }} data-uid='aaa'>
  <div
    style={{ backgroundColor: '#0091FFAA', width: 100, height: 100 }}
    data-uid='child-1'
    data-testid='child-1'
  />
  <div
    style={{ backgroundColor: '#0091FFAA', position: 'absolute', left: 100, top: 150, width: 200, height: 100 }}
    data-uid='child-2'
  />
  <div
    style={{ backgroundColor: '#0091FFAA', width: 200, height: 100, display: 'inline-flex' }}
    data-uid='child-3'
  />
</div>
`
const TestProject2 = `
<div style={{ width: '100%', height: '100%' }} data-uid='aaa'>
  <div
    style={{ backgroundColor: '#0091FFAA', width: 100, height: 100 }}
    data-uid='child-1'
    data-testid='child-1'
  />
  <div
    style={{ backgroundColor: '#0091FFAA', width: 100, height: 100 }}
    data-uid='child-2'
  />
  <div
    style={{ backgroundColor: '#0091FFAA', width: 200, height: 100, position: 'relative' }}
    data-uid='child-3'
  />
</div>
`

describe('Drag To Move Metastrategy', () => {
  it('when no reparent or no base move is fit, the fallback DO_NOTHING strategy is used', async () => {
    const renderResult = await renderTestEditorWithCode(
      makeTestProjectCodeWithSnippet(TestProject1),
      'await-first-dom-report',
    )

    const targetElement = renderResult.renderedDOM.getByTestId('child-1')
    const targetElementBounds = targetElement.getBoundingClientRect()
    const canvasControlsLayer = renderResult.renderedDOM.getByTestId(CanvasControlsContainerID)

    const startPoint = windowPoint({ x: targetElementBounds.x + 5, y: targetElementBounds.y + 5 })
    const dragDelta = windowPoint({ x: 10, y: 10 })

    const midDragCallback = () => {
      expect(renderResult.getEditorState().strategyState.currentStrategy).toEqual('DO_NOTHING')
    }

    mouseClickAtPoint(canvasControlsLayer, startPoint, { modifiers: cmdModifier })
    mouseDragFromPointWithDelta(canvasControlsLayer, startPoint, dragDelta, {
      modifiers: emptyModifiers,
      midDragCallback: midDragCallback,
    })
  })
  it('when a reorder strategy is active, the fallback DO_NOTHING strategy is not applicable', async () => {
    const renderResult = await renderTestEditorWithCode(
      makeTestProjectCodeWithSnippet(TestProject2),
      'await-first-dom-report',
    )

    const targetElement = renderResult.renderedDOM.getByTestId('child-1')
    const targetElementBounds = targetElement.getBoundingClientRect()
    const canvasControlsLayer = renderResult.renderedDOM.getByTestId(CanvasControlsContainerID)

    const startPoint = windowPoint({ x: targetElementBounds.x + 5, y: targetElementBounds.y + 5 })
    const dragDelta = windowPoint({ x: 10, y: 10 })

    const midDragCallback = () => {
      const strategies = renderResult.getEditorState().strategyState.sortedApplicableStrategies
      const doNothingInSortedStrategies = strategies?.findIndex(
        (strategy) => strategy.name === 'DO_NOTHING',
      )

      expect(renderResult.getEditorState().strategyState.currentStrategy).toEqual('FLOW_REORDER')
      expect(doNothingInSortedStrategies).toEqual(-1)
    }

    mouseClickAtPoint(canvasControlsLayer, startPoint, { modifiers: cmdModifier })
    mouseDragFromPointWithDelta(canvasControlsLayer, startPoint, dragDelta, {
      modifiers: emptyModifiers,
      midDragCallback: midDragCallback,
    })
  })
  it('when a reparent strategy is active, the fallback DO_NOTHING strategy is not applicable', async () => {
    const renderResult = await renderTestEditorWithCode(
      makeTestProjectCodeWithSnippet(TestProject2),
      'await-first-dom-report',
    )

    const targetElement = renderResult.renderedDOM.getByTestId('child-1')
    const targetElementBounds = targetElement.getBoundingClientRect()
    const canvasControlsLayer = renderResult.renderedDOM.getByTestId(CanvasControlsContainerID)

    const startPoint = windowPoint({ x: targetElementBounds.x + 5, y: targetElementBounds.y + 5 })
    const dragDelta = windowPoint({ x: -100, y: -100 })

    const midDragCallback = () => {
      const strategies = renderResult.getEditorState().strategyState.sortedApplicableStrategies
      const doNothingInSortedStrategies = strategies?.findIndex(
        (strategy) => strategy.name === 'DO_NOTHING',
      )

      expect(renderResult.getEditorState().strategyState.currentStrategy).toEqual(
        'FLEX_REPARENT_TO_ABSOLUTE',
      )
      expect(doNothingInSortedStrategies).toEqual(-1)
    }

    mouseClickAtPoint(canvasControlsLayer, startPoint, { modifiers: cmdModifier })
    mouseDragFromPointWithDelta(canvasControlsLayer, startPoint, dragDelta, {
      modifiers: emptyModifiers,
      midDragCallback: midDragCallback,
    })
  })
})