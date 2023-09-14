import * as EP from '../../../core/shared/element-path'
import type { WindowPoint } from '../../../core/shared/math-utils'
import { windowPoint } from '../../../core/shared/math-utils'
import { NO_OP } from '../../../core/shared/utils'
import { createModifiedProject } from '../../../sample-projects/sample-project-utils.test-utils'
import type { Modifiers } from '../../../utils/modifiers'
import { emptyModifiers, cmdModifier } from '../../../utils/modifiers'
import {
  selectComponentsForTest,
  setFeatureForBrowserTestsUseInDescribeBlockOnly,
  wait,
} from '../../../utils/utils.test-utils'
import { switchEditorMode } from '../../editor/actions/action-creators'
import { EditorModes } from '../../editor/editor-modes'
import { StoryboardFilePath, navigatorEntryToKey } from '../../editor/store/editor-state'
import { AddRemoveLayouSystemControlTestId } from '../../inspector/add-remove-layout-system-control'
import { CanvasControlsContainerID } from '../controls/new-canvas-controls'
import {
  MockClipboardHandlers,
  firePasteEvent,
  mouseClickAtPoint,
  mouseDownAtPoint,
  mouseDragFromPointWithDelta,
  pressKey,
} from '../event-helpers.test-utils'
import { REMIX_SCENE_TESTID } from '../ui-jsx-canvas-renderer/remix-scene-component'
import type { EditorRenderResult } from '../ui-jsx.test-utils'
import {
  getPrintedUiJsCode,
  getPrintedUiJsCodeWithoutUIDs,
  renderTestEditorWithModel,
} from '../ui-jsx.test-utils'

const DefaultRouteTextContent = 'Hello Remix!'
const RootTextContent = 'This is root!'

const storyboardFileContent = `
import * as React from 'react';
import Utopia, {
  Scene,
  Storyboard,
  RemixScene,
} from 'utopia-api';


export var storyboard = (
  <Storyboard data-uid='storyboard'>
    <Scene
      data-uid='scene'
      style={{ position: 'absolute', left: 400, top: 0, width: 375, height: 812 }}
    >
      <RemixScene />
    </Scene>
  </Storyboard>
);
`

/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectRemixSceneToBeRendered"] }] */

describe('Remix content', () => {
  setFeatureForBrowserTestsUseInDescribeBlockOnly('Remix support', true)
  it('Renders the remix container with actual content', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
      import { RemixScene, Storyboard } from 'utopia-api'
      
      export var storyboard = (
        <Storyboard>
          <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 212,
              top: 128,
            }}
            data-label='Playground'
          />
        </Storyboard>
      )
      `,
      ['/src/root.js']: `import React from 'react'
      import { Outlet } from '@remix-run/react'
      
      export default function Root() {
        return (
          <div>
            ${RootTextContent}
            <Outlet />
          </div>
        )
      }
      `,
      ['/src/routes/_index.js']: `import React from 'react'

      export default function Index() {
        return <h1>${DefaultRouteTextContent}</h1>
      }
      `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')
    await expectRemixSceneToBeRendered(renderResult)
  })

  it('Remix content has metadata', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
      import { RemixScene, Storyboard } from 'utopia-api'
      
      export var storyboard = (
        <Storyboard data-uid='storyboard'>
          <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 212,
              top: 128,
            }}
            data-label='Playground'
            data-uid='remix-scene'
          />
        </Storyboard>
      )
      `,
      ['/src/root.js']: `import React from 'react'
      import { Outlet } from '@remix-run/react'
      
      export default function Root() {
        return (
          <div data-uid='rootdiv'>
            ${RootTextContent}
            <Outlet data-uid='outlet'/>
          </div>
        )
      }
      `,
      ['/src/routes/_index.js']: `import React from 'react'

      export default function Index() {
        return <div
          style={{
            width: 200,
            height: 200,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          data-uid='remix-div'
        >
          ${DefaultRouteTextContent}
        </div>
      }
      `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')

    const remixDivMetadata =
      renderResult.getEditorState().editor.jsxMetadata[
        'storyboard/remix-scene:rootdiv/outlet:remix-div'
      ]

    expect(remixDivMetadata).not.toBeUndefined()

    expect(remixDivMetadata.globalFrame).toEqual({
      height: 200,
      width: 200,
      x: 212,
      y: 128,
    })
  })

  it('Two remix scenes, both have metadata', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
      import { RemixScene, Storyboard } from 'utopia-api'
      
      export var storyboard = (
        <Storyboard data-uid='storyboard'>
          <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 212,
              top: 128,
            }}
            data-label='Playground'
            data-uid='remix-scene'
          />
           <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 0,
              top: 0,
            }}
            data-label='Playground'
            data-uid='remix-scene-2'
          />
        </Storyboard>
      )
      `,
      ['/src/root.js']: `import React from 'react'
      import { Outlet } from '@remix-run/react'
      
      export default function Root() {
        return (
          <div data-uid='rootdiv'>
            ${RootTextContent}
            <Outlet data-uid='outlet'/>
          </div>
        )
      }
      `,
      ['/src/routes/_index.js']: `import React from 'react'

      export default function Index() {
        return <div
          style={{
            width: 200,
            height: 200,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          data-uid='remix-div'
        >
          ${DefaultRouteTextContent}
        </div>
      }
      `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')

    const remixDivMetadata =
      renderResult.getEditorState().editor.jsxMetadata[
        'storyboard/remix-scene:rootdiv/outlet:remix-div'
      ]

    expect(remixDivMetadata).not.toBeUndefined()

    expect(remixDivMetadata.globalFrame).toEqual({
      height: 200,
      width: 200,
      x: 212,
      y: 128,
    })

    const remixDiv2Metadata =
      renderResult.getEditorState().editor.jsxMetadata[
        'storyboard/remix-scene-2:rootdiv/outlet:remix-div'
      ]

    expect(remixDiv2Metadata).not.toBeUndefined()

    expect(remixDiv2Metadata.globalFrame).toEqual({
      height: 200,
      width: 200,
      x: 0,
      y: 0,
    })
  })

  it('Remix content can be selected', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
      import { RemixScene, Storyboard } from 'utopia-api'
      
      export var storyboard = (
        <Storyboard data-uid='storyboard'>
          <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 212,
              top: 128,
            }}
            data-label='Playground'
            data-uid='remix-scene'
          />
        </Storyboard>
      )
      `,
      ['/src/root.js']: `import React from 'react'
      import { Outlet } from '@remix-run/react'
      
      export default function Root() {
        return (
          <div data-uid='rootdiv'>
            ${RootTextContent}
            <Outlet data-uid='outlet'/>
          </div>
        )
      }
      `,
      ['/src/routes/_index.js']: `import React from 'react'

      export default function Index() {
        return <div data-uid='remix-route-root'>
          <div data-uid='remix-div' data-testid='remix-div'>${DefaultRouteTextContent}</div>
        </div>
      }
      `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')

    const targetElement = renderResult.renderedDOM.getByTestId('remix-div')
    const targetElementBounds = targetElement.getBoundingClientRect()

    const clickPoint = windowPoint({ x: targetElementBounds.x + 5, y: targetElementBounds.y + 5 })
    const canvasControlsLayer = renderResult.renderedDOM.getByTestId(CanvasControlsContainerID)
    await mouseClickAtPoint(canvasControlsLayer, clickPoint, { modifiers: cmdModifier })

    expect(renderResult.getEditorState().editor.selectedViews).toHaveLength(1)

    expect(EP.toString(renderResult.getEditorState().editor.selectedViews[0])).toEqual(
      'storyboard/remix-scene:rootdiv/outlet:remix-route-root/remix-div',
    )
  })

  it('Remix content is rendered while a canvas interaction is in progress', async () => {
    const DraggedElementId = 'dragme'
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
      import { RemixScene, Storyboard } from 'utopia-api'
      
      export var storyboard = (
        <Storyboard>
          <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 212,
              top: 128,
            }}
            data-label='Playground'
          />
          <div
            style={{
              backgroundColor: '#aaaaaa33',
              position: 'absolute',
              left: 213,
              top: 47,
              width: 130,
              height: 61,
            }}
            data-uid='46a'
            data-testid='${DraggedElementId}'
          />
        </Storyboard>
      )
      `,
      ['/src/root.js']: `import React from 'react'
      import { Outlet } from '@remix-run/react'
      
      export default function Root() {
        return (
          <div>
            ${RootTextContent}
            <Outlet />
          </div>
        )
      }
      `,
      ['/src/routes/_index.js']: `import React from 'react'

      export default function Index() {
        return <h1>${DefaultRouteTextContent}</h1>
      }
      `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')

    const targetElement = renderResult.renderedDOM.getByTestId(DraggedElementId)
    const targetElementBounds = targetElement.getBoundingClientRect()

    const startPoint = windowPoint({ x: targetElementBounds.x + 5, y: targetElementBounds.y + 5 })
    const dragDelta = windowPoint({ x: 40, y: -25 })

    await expectRemixSceneToBeRendered(renderResult)

    await dragMouse(renderResult, startPoint, dragDelta, emptyModifiers, () =>
      expectRemixSceneToBeRendered(renderResult),
    )
  })
})

describe('Remix content with feature switch off', () => {
  setFeatureForBrowserTestsUseInDescribeBlockOnly('Remix support', false)
  it('Doesnt render the remix container with feature switch off', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: storyboardFileContent,
    })
    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')
    await expect(async () =>
      renderResult.renderedDOM.findAllByTestId(REMIX_SCENE_TESTID),
    ).rejects.toThrow()
  })
})

describe('Remix navigation', () => {
  setFeatureForBrowserTestsUseInDescribeBlockOnly('Remix support', true)
  it('Can navigate to a different route', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
        import { RemixScene, Storyboard } from 'utopia-api'
        
        export var storyboard = (
          <Storyboard>
            <RemixScene
              style={{
                width: 700,
                height: 759,
                position: 'absolute',
                left: 212,
                top: 128,
              }}
              data-label='Playground'
            />
          </Storyboard>
        )
        `,
      ['/src/root.js']: `import React from 'react'
        import { Outlet } from '@remix-run/react'
        
        export default function Root() {
          return (
            <div>
              ${RootTextContent}
              <Outlet />
            </div>
          )
        }
        `,
      ['/src/routes/_index.js']: `import React from 'react'
        import { Link } from '@remix-run/react'
  
        export default function Index() {
          return <Link to='/about' data-testid='remix-link'>${DefaultRouteTextContent}</Link>
        }
        `,
      ['/src/routes/about.js']: `import React from 'react'
  
        export default function About() {
          return <h1>About</h1>
        }
        `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')
    await renderResult.dispatch([switchEditorMode(EditorModes.liveMode())], true)

    const targetElement = renderResult.renderedDOM.getByTestId('remix-link')
    const targetElementBounds = targetElement.getBoundingClientRect()

    const clickPoint = windowPoint({ x: targetElementBounds.x + 5, y: targetElementBounds.y + 5 })

    await mouseClickAtPoint(targetElement, clickPoint)

    await expectRemixSceneToBeRendered(renderResult, 'About')
  })

  it('Remix navigation updates metadata', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
      import { RemixScene, Storyboard } from 'utopia-api'
      
      export var storyboard = (
        <Storyboard data-uid='storyboard'>
          <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 212,
              top: 128,
            }}
            data-label='Playground'
            data-uid='remix-scene'
          />
        </Storyboard>
      )
      `,
      ['/src/root.js']: `import React from 'react'
      import { Outlet } from '@remix-run/react'
      
      export default function Root() {
        return (
          <div data-uid='rootdiv'>
            ${RootTextContent}
            <Outlet data-uid='outlet'/>
          </div>
        )
      }
      `,
      ['/src/routes/_index.js']: `import React from 'react'
      import { Link } from '@remix-run/react'

      export default function Index() {
        return <Link to='/about' data-testid='remix-link' data-uid='remixlink'>${DefaultRouteTextContent}</Link>
      }
      `,
      ['/src/routes/about.js']: `import React from 'react'

      export default function About() {
        return <div
          style={{
            width: 200,
            height: 200,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          data-uid='aboutdiv'
        >
          About
        </div>
      }
      `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')

    const remixLinkMetadata =
      renderResult.getEditorState().editor.jsxMetadata[
        'storyboard/remix-scene:rootdiv/outlet:remixlink'
      ]
    expect(remixLinkMetadata).not.toBeUndefined()

    await renderResult.dispatch([switchEditorMode(EditorModes.liveMode())], true)

    const targetElement = renderResult.renderedDOM.getByTestId('remix-link')
    const targetElementBounds = targetElement.getBoundingClientRect()

    const clickPoint = windowPoint({ x: targetElementBounds.x + 5, y: targetElementBounds.y + 5 })

    await mouseClickAtPoint(targetElement, clickPoint)

    const remixLinkMetadataAfterNavigation =
      renderResult.getEditorState().editor.jsxMetadata[
        'storyboard/remix-scene:rootdiv/outlet:remixlink'
      ]
    expect(remixLinkMetadataAfterNavigation).toBeUndefined()

    const remixAboutDivMetadata =
      renderResult.getEditorState().editor.jsxMetadata[
        'storyboard/remix-scene:rootdiv/outlet:aboutdiv'
      ]

    expect(remixAboutDivMetadata).not.toBeUndefined()
    expect(remixAboutDivMetadata.globalFrame).toEqual({
      height: 200,
      width: 200,
      x: 212,
      y: 128,
    })
  })
})

describe('Editing Remix content', () => {
  setFeatureForBrowserTestsUseInDescribeBlockOnly('Remix support', true)

  it('set opacity on remix element', async () => {
    const project = createModifiedProject({
      [StoryboardFilePath]: `import * as React from 'react'
      import { RemixScene, Storyboard } from 'utopia-api'
      
      export var storyboard = (
        <Storyboard data-uid='sb'>
          <RemixScene
            style={{
              width: 700,
              height: 759,
              position: 'absolute',
              left: 212,
              top: 128,
            }}
            data-uid='rs'
            data-label='Playground'
          />
        </Storyboard>
      )
      `,
      ['/src/root.js']: `import React from 'react'
      import { Outlet } from '@remix-run/react'
      
      export default function Root() {
        return (
          <div data-uid='root'>
            ${RootTextContent}
            <Outlet data-uid='outlet' />
          </div>
        )
      }
      `,
      ['/src/routes/_index.js']: `import React from 'react'

      export default function Index() {
        return <h1 data-uid='title' data-testid='title'>${DefaultRouteTextContent}</h1>
      }
      `,
    })

    const renderResult = await renderTestEditorWithModel(project, 'await-first-dom-report')

    const pathString = 'sb/rs:root/outlet:title'

    await selectComponentsForTest(renderResult, [EP.fromString(pathString)])
    await pressKey('3')
    await pressKey('0')

    const titleElement = renderResult.renderedDOM.getByTestId('title')
    expect(titleElement.style.opacity).toEqual('0.3')
  })

  const FlexDivTestId = 'flex-div'
  const AbsoluteDivTestId = 'absolute-div'
  const Child1TestId = 'child-1'

  const IndexJSFIlePath = '/src/routes/_index.js'

  const remixProjectForEditingTests = createModifiedProject({
    [StoryboardFilePath]: `import * as React from 'react'
    import { Storyboard, RemixScene } from 'utopia-api'
    
    export var storyboard = (
      <Storyboard data-uid='sb'>
        <RemixScene
          className='my-class'
          style={{
            position: 'absolute',
            width: 834,
            height: 1328,
            left: 8,
            top: -24,
            overflow: 'hidden',
          }}
          data-label='Mood Board'
          data-uid='remix-scene'
        />
      </Storyboard>
    )    
    `,
    ['/src/root.js']: `import * as React from 'react'
    import { Outlet } from '@remix-run/react'
    
    export default function App() {
      return (
        <div
          className='my-class'
          style={{
            width: '100%',
            height: '100%',
            contain: 'layout',
            transition: 'all 3s ease-out',
          }}
          data-uid='app'
        >
          <Outlet data-uid='outlet' />
        </div>
      )
    }    
    `,
    [IndexJSFIlePath]: `import * as React from 'react'
    import { Link } from '@remix-run/react'
    
    export default function Index() {
      return (
        <div
          className='my-class'
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--off-white)',
            padding: '0px 0px 25px',
            boxShadow: '0px 2px 33px var(--yellow)',
            transition: 'all 3s ease-out',
          }}
          data-uid='index'
        >
          <div
            style={{
              backgroundColor: '#aaaaaa33',
              width: 752,
              height: 224,
              contain: 'layout',
              position: 'absolute',
              left: 46,
              top: 64,
            }}
            data-uid='absolute-div'
            data-testid='${AbsoluteDivTestId}'
          />
          <div
            style={{
              backgroundColor: '#aaaaaa33',
              contain: 'layout',
              width: 752,
              height: 'max-content',
              position: 'absolute',
              left: 46,
              top: 340,
              display: 'flex',
              flexDirection: 'row',
              gap: 26,
              padding: '44px 20px',
            }}
            data-uid='flex-div'
            data-testid='${FlexDivTestId}'
          >
            <div
              style={{
                backgroundColor: '#aaaaaa33',
                width: 212,
                height: 136,
                contain: 'layout',
              }}
              data-uid='${Child1TestId}'
              data-testid='${Child1TestId}'
            />
            <div
              style={{
                backgroundColor: '#aaaaaa33',
                width: 212,
                height: 136,
                contain: 'layout',
              }}
              data-uid='child-2'
            />
            <div
              style={{
                backgroundColor: '#aaaaaa33',
                width: 212,
                height: 136,
                contain: 'layout',
              }}
              data-uid='child-3'
            />
          </div>
        </div>
      )
    }    
    `,
  })

  it('delete element from remix scene', async () => {
    const renderResult = await renderTestEditorWithModel(
      remixProjectForEditingTests,
      'await-first-dom-report',
    )

    expect(renderResult.renderedDOM.queryAllByTestId(FlexDivTestId)).toHaveLength(1)

    await clickElementOnCanvas(renderResult, FlexDivTestId)
    await pressKey('Backspace')

    expect(renderResult.renderedDOM.queryAllByTestId(FlexDivTestId)).toHaveLength(0)

    expect(getPrintedUiJsCode(renderResult.getEditorState(), IndexJSFIlePath))
      .toEqual(`import * as React from 'react'
import { Link } from '@remix-run/react'

export default function Index() {
  return (
    <div
      className='my-class'
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--off-white)',
        padding: '0px 0px 25px',
        boxShadow: '0px 2px 33px var(--yellow)',
        transition: 'all 3s ease-out',
      }}
      data-uid='index'
    >
      <div
        style={{
          backgroundColor: '#aaaaaa33',
          width: 752,
          height: 224,
          contain: 'layout',
          position: 'absolute',
          left: 46,
          top: 64,
        }}
        data-uid='absolute-div'
        data-testid='absolute-div'
      />
    </div>
  )
}
`)
  })

  it('use the inspector to add a layout system', async () => {
    const renderResult = await renderTestEditorWithModel(
      remixProjectForEditingTests,
      'await-first-dom-report',
    )

    const absoluteDiv = await clickElementOnCanvas(renderResult, AbsoluteDivTestId)

    const targetElement = renderResult.renderedDOM.getByTestId(AddRemoveLayouSystemControlTestId())
    await mouseClickAtPoint(targetElement, { x: 1, y: 1 }, { modifiers: cmdModifier })

    expect(absoluteDiv.style.display).toEqual('flex')
  })

  it('flex reorder elements inside Remix', async () => {
    const renderResult = await renderTestEditorWithModel(
      remixProjectForEditingTests,
      'await-first-dom-report',
    )

    expect(renderResult.getEditorState().derived.navigatorTargets.map(navigatorEntryToKey)).toEqual(
      [
        'regular-sb/remix-scene',
        'regular-sb/remix-scene:app',
        'regular-sb/remix-scene:app/outlet',
        'regular-sb/remix-scene:app/outlet:index',
        'regular-sb/remix-scene:app/outlet:index/absolute-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-1',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-2',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-3',
      ],
    )

    const child1 = await clickElementOnCanvas(renderResult, Child1TestId)
    const child1Bounds = child1.getBoundingClientRect()
    await dragMouse(
      renderResult,
      windowPoint({ x: child1Bounds.x + 1, y: child1Bounds.y + 1 }),
      windowPoint({ x: child1Bounds.width * 1.5, y: 0 }),
    )

    expect(renderResult.getEditorState().derived.navigatorTargets.map(navigatorEntryToKey)).toEqual(
      [
        'regular-sb/remix-scene',
        'regular-sb/remix-scene:app',
        'regular-sb/remix-scene:app/outlet',
        'regular-sb/remix-scene:app/outlet:index',
        'regular-sb/remix-scene:app/outlet:index/absolute-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-2',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-1', // <- child1 is the middle element after the reorder
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-3',
      ],
    )
  })

  it('absolute move elements inside Remix', async () => {
    const renderResult = await renderTestEditorWithModel(
      remixProjectForEditingTests,
      'await-first-dom-report',
    )

    const absoluteDiv = await clickElementOnCanvas(renderResult, AbsoluteDivTestId)
    expect({ left: absoluteDiv.style.left, top: absoluteDiv.style.top }).toEqual({
      left: '46px',
      top: '64px',
    })

    const absoluteDivBounds = absoluteDiv.getBoundingClientRect()
    await dragMouse(
      renderResult,
      windowPoint({ x: absoluteDivBounds.x + 1, y: absoluteDivBounds.y + 1 }),
      windowPoint({ x: 33, y: 33 }),
    )

    expect({ left: absoluteDiv.style.left, top: absoluteDiv.style.top }).toEqual({
      left: '82px',
      top: '97px',
    })
  })

  it('draw to insert into Remix', async () => {
    const renderResult = await renderTestEditorWithModel(
      remixProjectForEditingTests,
      'await-first-dom-report',
    )

    expect(renderResult.getEditorState().derived.navigatorTargets.map(navigatorEntryToKey)).toEqual(
      [
        'regular-sb/remix-scene',
        'regular-sb/remix-scene:app',
        'regular-sb/remix-scene:app/outlet',
        'regular-sb/remix-scene:app/outlet:index',
        'regular-sb/remix-scene:app/outlet:index/absolute-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-1',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-2',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-3',
      ],
    )

    await pressKey('d') // enter draw to insert mode

    const absoluteDiv = await clickElementOnCanvas(renderResult, AbsoluteDivTestId)
    const absoluteDivBounds = absoluteDiv.getBoundingClientRect()

    await dragMouse(
      renderResult,
      windowPoint({ x: absoluteDivBounds.x + 5, y: absoluteDivBounds.y + 5 }),
      windowPoint({ x: 12, y: 12 }),
    )

    // the new div is in there
    expect(getPrintedUiJsCodeWithoutUIDs(renderResult.getEditorState(), IndexJSFIlePath))
      .toEqual(`import * as React from 'react'
import { Link } from '@remix-run/react'

export default function Index() {
  return (
    <div
      className='my-class'
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--off-white)',
        padding: '0px 0px 25px',
        boxShadow: '0px 2px 33px var(--yellow)',
        transition: 'all 3s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#aaaaaa33',
          width: 752,
          height: 224,
          contain: 'layout',
          position: 'absolute',
          left: 46,
          top: 64,
        }}
        data-testid='absolute-div'
      >
        <div
          style={{
            backgroundColor: '#aaaaaa33',
            position: 'absolute',
            left: -35,
            top: -35,
            width: 100,
            height: 100,
          }}
        />
      </div>
      <div
        style={{
          backgroundColor: '#aaaaaa33',
          contain: 'layout',
          width: 752,
          height: 'max-content',
          position: 'absolute',
          left: 46,
          top: 340,
          display: 'flex',
          flexDirection: 'row',
          gap: 26,
          padding: '44px 20px',
        }}
        data-testid='flex-div'
      >
        <div
          style={{
            backgroundColor: '#aaaaaa33',
            width: 212,
            height: 136,
            contain: 'layout',
          }}
          data-testid='child-1'
        />
        <div
          style={{
            backgroundColor: '#aaaaaa33',
            width: 212,
            height: 136,
            contain: 'layout',
          }}
        />
        <div
          style={{
            backgroundColor: '#aaaaaa33',
            width: 212,
            height: 136,
            contain: 'layout',
          }}
        />
      </div>
    </div>
  )
}
`)
  })

  const clipboardMock = new MockClipboardHandlers().mock()

  it('copy-paste element inside Remix', async () => {
    const renderResult = await renderTestEditorWithModel(
      remixProjectForEditingTests,
      'await-first-dom-report',
    )

    await selectComponentsForTest(renderResult, [
      EP.fromString('sb/remix-scene:app/outlet:index/absolute-div'),
    ])
    await pressKey('c', { modifiers: cmdModifier })
    const canvasRoot = renderResult.renderedDOM.getByTestId('canvas-root')

    firePasteEvent(canvasRoot)

    await clipboardMock.pasteDone
    await renderResult.getDispatchFollowUpActionsFinished()

    // the new div is in there
    expect(getPrintedUiJsCodeWithoutUIDs(renderResult.getEditorState(), IndexJSFIlePath))
      .toEqual(`import * as React from 'react'
import { Link } from '@remix-run/react'

export default function Index() {
  return (
    <div
      className='my-class'
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--off-white)',
        padding: '0px 0px 25px',
        boxShadow: '0px 2px 33px var(--yellow)',
        transition: 'all 3s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#aaaaaa33',
          width: 752,
          height: 224,
          contain: 'layout',
          position: 'absolute',
          left: 46,
          top: 64,
        }}
        data-testid='absolute-div'
      />
      <div
        style={{
          backgroundColor: '#aaaaaa33',
          width: 752,
          height: 224,
          contain: 'layout',
          position: 'absolute',
          left: 808,
          top: 64,
        }}
        data-testid='absolute-div'
      />
      <div
        style={{
          backgroundColor: '#aaaaaa33',
          contain: 'layout',
          width: 752,
          height: 'max-content',
          position: 'absolute',
          left: 46,
          top: 340,
          display: 'flex',
          flexDirection: 'row',
          gap: 26,
          padding: '44px 20px',
        }}
        data-testid='flex-div'
      >
        <div
          style={{
            backgroundColor: '#aaaaaa33',
            width: 212,
            height: 136,
            contain: 'layout',
          }}
          data-testid='child-1'
        />
        <div
          style={{
            backgroundColor: '#aaaaaa33',
            width: 212,
            height: 136,
            contain: 'layout',
          }}
        />
        <div
          style={{
            backgroundColor: '#aaaaaa33',
            width: 212,
            height: 136,
            contain: 'layout',
          }}
        />
      </div>
    </div>
  )
}
`)
  })

  it('dragging elements between Remix and the storyboard', async () => {
    const renderResult = await renderTestEditorWithModel(
      remixProjectForEditingTests,
      'await-first-dom-report',
    )
    expect(renderResult.getEditorState().derived.navigatorTargets.map(navigatorEntryToKey)).toEqual(
      [
        'regular-sb/remix-scene',
        'regular-sb/remix-scene:app',
        'regular-sb/remix-scene:app/outlet',
        'regular-sb/remix-scene:app/outlet:index',
        'regular-sb/remix-scene:app/outlet:index/absolute-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-1',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-2',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-3',
      ],
    )

    {
      // Drag the element out of Remix
      const absoluteElement = await clickElementOnCanvas(renderResult, AbsoluteDivTestId)
      const absoluteDivBounds = absoluteElement.getBoundingClientRect()
      await dragMouse(
        renderResult,
        windowPoint({ x: absoluteDivBounds.x + 1, y: absoluteDivBounds.y + 1 }),
        windowPoint({ x: 10, y: -77 }),
      )
    }

    expect(renderResult.getEditorState().derived.navigatorTargets.map(navigatorEntryToKey)).toEqual(
      [
        'regular-sb/remix-scene',
        'regular-sb/remix-scene:app',
        'regular-sb/remix-scene:app/outlet',
        'regular-sb/remix-scene:app/outlet:index',
        'regular-sb/remix-scene:app/outlet:index/flex-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-1',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-2',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-3',
        'regular-sb/absolute-div',
      ],
    )

    {
      // Drag the element back into Remix
      const absoluteElement = await clickElementOnCanvas(renderResult, AbsoluteDivTestId)
      const absoluteDivBounds = absoluteElement.getBoundingClientRect()
      await dragMouse(
        renderResult,
        windowPoint({ x: absoluteDivBounds.x + 1, y: absoluteDivBounds.y + 1 }),
        windowPoint({ x: -10, y: 77 }),
      )
    }

    expect(renderResult.getEditorState().derived.navigatorTargets.map(navigatorEntryToKey)).toEqual(
      [
        'regular-sb/remix-scene',
        'regular-sb/remix-scene:app',
        'regular-sb/remix-scene:app/outlet',
        'regular-sb/remix-scene:app/outlet:index',
        'regular-sb/remix-scene:app/outlet:index/flex-div',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-1',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-2',
        'regular-sb/remix-scene:app/outlet:index/flex-div/child-3',
        'regular-sb/remix-scene:app/outlet:index/absolute-div',
      ],
    )
  })
})

async function clickElementOnCanvas(
  renderResult: EditorRenderResult,
  testId: string,
): Promise<HTMLElement> {
  const targetElement = renderResult.renderedDOM.getByTestId(testId)
  const targetElementBounds = targetElement.getBoundingClientRect()

  const clickPoint = windowPoint({ x: targetElementBounds.x + 2, y: targetElementBounds.y + 2 })
  const canvasControlsLayer = renderResult.renderedDOM.getByTestId(CanvasControlsContainerID)
  await mouseClickAtPoint(canvasControlsLayer, clickPoint, { modifiers: cmdModifier })
  return targetElement
}

async function dragMouse(
  renderResult: EditorRenderResult,
  startPoint: WindowPoint,
  dragDelta: WindowPoint,
  modifiers: Modifiers = emptyModifiers,
  midDragCallback: () => Promise<void> = async () => NO_OP(),
): Promise<void> {
  const canvasControlsLayer = renderResult.renderedDOM.getByTestId(CanvasControlsContainerID)
  await mouseDownAtPoint(canvasControlsLayer, startPoint, { modifiers: cmdModifier })
  await mouseDragFromPointWithDelta(canvasControlsLayer, startPoint, dragDelta, {
    modifiers,
    midDragCallback,
  })
}

async function expectRemixSceneToBeRendered(
  editor: EditorRenderResult,
  textContent: string = DefaultRouteTextContent,
) {
  const [remixScene] = await editor.renderedDOM.findAllByTestId(REMIX_SCENE_TESTID)
  expect(remixScene).toBeDefined()

  const [rootText] = await editor.renderedDOM.findAllByText(RootTextContent)
  expect(rootText).toBeDefined()

  const [indexText] = await editor.renderedDOM.findAllByText(textContent)
  expect(indexText).toBeDefined()
}