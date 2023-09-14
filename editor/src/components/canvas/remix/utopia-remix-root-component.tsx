import { RemixContext } from '@remix-run/react/dist/components'
import type { RouteModules } from '@remix-run/react/dist/routeModules'
import React from 'react'
import type { Location } from 'react-router'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { UTOPIA_PATH_KEY } from '../../../core/model/utopia-constants'
import type { ElementPath } from '../../../core/shared/project-file-types'
import { useRefEditorState, useEditorState, Substores } from '../../editor/store/store-hook'
import * as EP from '../../../core/shared/element-path'
import { PathPropHOC } from './path-props-hoc'
import { atom, useAtom, useSetAtom } from 'jotai'
import { getDefaultExportNameAndUidFromFile } from '../../../core/model/project-file-utils'

type RouterType = ReturnType<typeof createMemoryRouter>

interface RemixNavigationContext {
  forward: () => void
  back: () => void
  home: () => void
  location: Location
  entries: Array<Location>
}

interface RemixNavigationAtomData {
  [pathString: string]: RemixNavigationContext
}

export const ActiveRemixSceneAtom = atom<ElementPath>(EP.emptyElementPath)
export const RemixNavigationAtom = atom<RemixNavigationAtomData>({})

function useGetRouteModules(basePath: ElementPath) {
  const remixDerivedDataRef = useRefEditorState((store) => store.derived.remixData)
  const projectContentsRef = useRefEditorState((store) => store.editor.projectContents)

  const defaultExports = useEditorState(
    Substores.derived,
    (store) => {
      const routeModuleCreators = store.derived.remixData?.routeModuleCreators ?? {}
      return Object.values(routeModuleCreators).map(
        (rmc) => getDefaultExportNameAndUidFromFile(projectContentsRef.current, rmc.filePath)?.name,
      )
    },
    '',
  )

  return React.useMemo(() => {
    const defaultExportsIgnored = defaultExports // Forcibly update the routeModules only when the default exports have changed

    if (remixDerivedDataRef.current == null) {
      return null
    }

    const routeModulesResult: RouteModules = {}
    for (const [routeId, value] of Object.entries(
      remixDerivedDataRef.current.routeModuleCreators,
    )) {
      const nameAndUid = getDefaultExportNameAndUidFromFile(
        projectContentsRef.current,
        value.filePath,
      )
      if (nameAndUid == null) {
        continue
      }

      const relativePath =
        remixDerivedDataRef.current.routeModulesToRelativePaths[routeId].relativePath

      const defaultComponent = (componentProps: any) =>
        value
          .executionScopeCreator(projectContentsRef.current)
          .scope[nameAndUid.name]?.(componentProps) ?? <React.Fragment />

      routeModulesResult[routeId] = {
        ...value,
        default: PathPropHOC(
          defaultComponent,
          EP.toString(EP.appendTwoPaths(basePath, relativePath)),
        ),
      }
    }

    return routeModulesResult
  }, [basePath, defaultExports, remixDerivedDataRef, projectContentsRef])
}

export interface UtopiaRemixRootComponentProps {
  [UTOPIA_PATH_KEY]: ElementPath
}

export const UtopiaRemixRootComponent = React.memo((props: UtopiaRemixRootComponentProps) => {
  const remixDerivedDataRef = useRefEditorState((store) => store.derived.remixData)

  const routes = useEditorState(
    Substores.derived,
    (store) => store.derived.remixData?.routes ?? [],
    'UtopiaRemixRootComponent routes',
  )

  const basePath = props[UTOPIA_PATH_KEY]

  const routeModules = useGetRouteModules(basePath)

  const [navigationData, setNavigationData] = useAtom(RemixNavigationAtom)
  const setActiveRemixScene = useSetAtom(ActiveRemixSceneAtom)

  const currentEntries = navigationData[EP.toString(basePath)]?.entries
  const currentEntriesRef = React.useRef(currentEntries)
  currentEntriesRef.current = currentEntries

  // The router always needs to be updated otherwise new routes won't work without a refresh
  // We need to create the new router with the current location in the initial entries to
  // prevent it thinking that it is rendering '/'
  const router = React.useMemo(() => {
    if (routes == null || routes.length === 0) {
      return null
    }
    const initialEntries = currentEntriesRef.current == null ? undefined : currentEntriesRef.current
    return createMemoryRouter(routes, { initialEntries: initialEntries })
  }, [routes])

  const updateNavigationData = React.useCallback(
    (innerRouter: RouterType, location: Location) => {
      setNavigationData((current) => {
        const key = EP.toString(basePath)
        const existingEntries = current[key]?.entries ?? []

        const updatedEntries =
          existingEntries.at(-1)?.pathname === location.pathname
            ? existingEntries
            : existingEntries.concat(location)

        return {
          ...current,
          [EP.toString(basePath)]: {
            forward: () => void innerRouter.navigate(1),
            back: () => void innerRouter.navigate(-1),
            home: () => void innerRouter.navigate('/'),
            location: location,
            entries: updatedEntries,
          },
        }
      })
      setActiveRemixScene(basePath)
    },
    [basePath, setActiveRemixScene, setNavigationData],
  )

  // initialize navigation data
  React.useLayoutEffect(() => {
    if (router != null && navigationData[EP.toString(basePath)] == null) {
      updateNavigationData(router, router.state.location)
    }
  }, [router, navigationData, basePath, updateNavigationData])

  // apply changes navigation data
  React.useLayoutEffect(() => {
    if (router != null) {
      return router?.subscribe((newState) => updateNavigationData(router, newState.location))
    }
    return
  }, [router, updateNavigationData])

  if (remixDerivedDataRef.current == null || router == null || routeModules == null) {
    return null
  }

  const { assetsManifest, futureConfig } = remixDerivedDataRef.current

  return (
    <RemixContext.Provider
      value={{
        manifest: assetsManifest,
        routeModules: routeModules,
        future: futureConfig,
      }}
    >
      <RouterProvider
        router={router}
        fallbackElement={null}
        future={{ v7_startTransition: true }}
      />
    </RemixContext.Provider>
  )
})