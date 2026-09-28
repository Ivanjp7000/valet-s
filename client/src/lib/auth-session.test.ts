import assert from 'node:assert/strict';
import {HttpError, isUnauthorizedError} from './authUtils';
import {apiRequest, getQueryFn, queryClient} from './queryClient';

const originalFetch = globalThis.fetch;
const key = ['/api/auth/user'];
try {
  queryClient.setQueryData(key, {id: 'test-user'});
  globalThis.fetch = async () => new Response('{"message":"Unauthorized"}', {status: 401});
  const user = await queryClient.fetchQuery({queryKey: key, queryFn: getQueryFn({on401: 'returnNull'}), staleTime: 0});
  assert.equal(user, null);
  assert.equal(queryClient.getQueryData(key), null, 'Expired auth must replace previously cached user');

  queryClient.setQueryData(key, {id: 'test-user'});
  await assert.rejects(apiRequest('POST', '/api/locations', {name: 'demo'}), error => {
    assert.ok(isUnauthorizedError(error));
    assert.match((error as Error).message, /sign-in has expired/);
    return true;
  });
  assert.equal(queryClient.getQueryData(key), null, 'A location 401 must remove stale sign-in state');

  queryClient.setQueryData(key, {id: 'test-user'});
  globalThis.fetch = async () => new Response('{"message":"Access denied to this OU"}', {status: 403});
  await assert.rejects(apiRequest('POST', '/api/locations'), error => error instanceof HttpError && error.status === 403 && !isUnauthorizedError(error));
  assert.deepEqual(queryClient.getQueryData(key), {id: 'test-user'}, 'Permission denial is not an expired session');
  assert.equal(isUnauthorizedError(new Error('401: {"message":"Unauthorized"}')), true);
  assert.equal(isUnauthorizedError(new Error('500: Unauthorized upstream service')), false);
  console.log('PASS: expired auth refetch, location 401, 403 scope preservation and legacy error handling');
} finally { globalThis.fetch = originalFetch; queryClient.clear(); }
