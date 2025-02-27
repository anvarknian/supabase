import { QueryKey, UseQueryOptions } from '@tanstack/react-query'
import { useCallback } from 'react'

import { Filter, Query, SupaTable } from 'components/grid'
import { ImpersonationRole, wrapWithRoleImpersonation } from 'lib/role-impersonation'
import { useIsRoleImpersonationEnabled } from 'state/role-impersonation-state'
import { ExecuteSqlData, useExecuteSqlPrefetch, useExecuteSqlQuery } from '../sql/execute-sql-query'
import { formatFilterValue } from './utils'

type GetTableRowsCountArgs = {
  table?: SupaTable
  filters?: Filter[]
  impersonatedRole?: ImpersonationRole
}

export const getTableRowsCountSqlQuery = ({ table, filters = [] }: GetTableRowsCountArgs) => {
  const query = new Query()

  if (!table) {
    return ``
  }

  let queryChains = query.from(table.name, table.schema ?? undefined).count()
  filters
    .filter((x) => x.value && x.value != '')
    .forEach((x) => {
      const value = formatFilterValue(table, x)
      queryChains = queryChains.filter(x.column, x.operator, value)
    })

  const sql = queryChains.toSql()

  return sql
}

export type TableRowsCount = {
  count: number
}

export type TableRowsCountVariables = GetTableRowsCountArgs & {
  projectRef?: string
  connectionString?: string
  queryKey?: QueryKey
}

export type TableRowsCountData = TableRowsCount
export type TableRowsCountError = unknown

export const useTableRowsCountQuery = <TData extends TableRowsCountData = TableRowsCountData>(
  {
    projectRef,
    connectionString,
    queryKey,
    table,
    impersonatedRole,
    ...args
  }: TableRowsCountVariables,
  options: UseQueryOptions<ExecuteSqlData, TableRowsCountError, TData> = {}
) => {
  const isRoleImpersonationEnabled = useIsRoleImpersonationEnabled()

  return useExecuteSqlQuery(
    {
      projectRef,
      connectionString,
      sql: wrapWithRoleImpersonation(getTableRowsCountSqlQuery({ table, ...args }), {
        projectRef: projectRef ?? 'ref',
        role: impersonatedRole,
      }),
      queryKey: [
        ...(queryKey ?? []),
        {
          table: { name: table?.name, schema: table?.schema },
          impersonatedRole,
          ...args,
        },
      ],
      isRoleImpersonationEnabled,
    },
    {
      select(data) {
        return {
          count: data.result[0].count,
        } as TData
      },
      enabled: typeof projectRef !== 'undefined' && typeof table !== 'undefined',
      ...options,
    }
  )
}

/**
 * useTableRowsCountPrefetch is used for prefetching the table rows count. For example, starting a query loading before a page is navigated to.
 *
 * @example
 * const prefetch = useTableRowsCountPrefetch()
 *
 * return (
 *   <Link onMouseEnter={() => prefetch({ ...args })}>
 *     Start loading on hover
 *   </Link>
 * )
 */
export const useTableRowsCountPrefetch = () => {
  const prefetch = useExecuteSqlPrefetch()

  return useCallback(
    ({ projectRef, connectionString, queryKey, table, ...args }: TableRowsCountVariables) =>
      prefetch({
        projectRef,
        connectionString,
        sql: getTableRowsCountSqlQuery({ table, ...args }),
        queryKey: [
          ...(queryKey ?? []),
          { table: { name: table?.name, schema: table?.schema }, ...args },
        ],
      }),
    [prefetch]
  )
}
