import { Router } from 'express'
import createError from 'http-errors'
import database from 'better-sqlite3-helper'
import md5 from 'md5'

/**
 *  User Files       /u/<:username>
 *  User Albums      /u/<:username>/albums
 *  User Settings    /u/<:username>/settings
 *  User Update      /u/<:username>/update
 */

export default Router()

  .use((req, res, next) => {
    let sort = req.query.sort || 'DESC'
    let filter = req.query.filter || ''
    let limit = req.query.limit || config.pagination.limit.default
    req.viewPage = +req.query.p || 1
    req.viewLimit = limit > config.pagination.limit.max
      ? config.pagination.limit.default
      : limit > 0
        ? limit
        : config.pagination.limit.default
    req.viewOffset = req.viewLimit * (req.viewPage - 1)
    req.viewJson = Object.keys(req.query).includes('json')
      ? true
      : false
    req.sortOrder = (sort !== 'DESC' && sort !== 'ASC')
      ? 'DESC'
      : sort
    req.filter = (filter !== 'image' && filter !== 'audio' && filter !== 'video' && filter !== 'text')
    ? ''
    : filter
    req.urlParams = ''
    if (req.filter !== '') req.urlParams += `&filter=${req.filter}`
    if (req.sortOrder !== 'DESC') req.urlParams += `&sort=${req.sortOrder}`
    if (req.viewLimit !== config.pagination.limit.default) req.urlParams += `&limit=${req.viewLimit}`

    next()
  })

  // GET Method Routes
  .get('/:username', (req, res, next) => {
    let username = req.params.username
    let showPrivate = req.isAuthenticated().username === username

    if (database().queryFirstCell(`SELECT username FROM users WHERE username=?`, username)) {
      let files = showPrivate
        ? database().query(`SELECT id, file_id, mimetype, public FROM files WHERE uploaded_by=? AND in_album IS NULL AND mimetype LIKE "${req.filter}%"
                            ORDER BY id ${req.sortOrder} LIMIT ? OFFSET ?`, username, req.viewLimit, req.viewOffset)
        : database().query(`SELECT id, file_id, mimetype, public FROM files WHERE uploaded_by=? AND in_album IS NULL AND NOT public=0 AND mimetype LIKE "${req.filter}%"
                            ORDER BY id ${req.sortOrder} LIMIT ? OFFSET ?`, username, req.viewLimit, req.viewOffset)

      let totalFiles = showPrivate
        ? database().query(`SELECT COUNT(id) FROM files WHERE uploaded_by=? AND in_album IS NULL AND mimetype LIKE "${req.filter}%"`, username)
        : database().query(`SELECT COUNT(id) FROM files WHERE uploaded_by=? AND in_album IS NULL AND NOT public=0 AND mimetype LIKE "${req.filter}%"`, username)

      let email = database().queryFirstCell(`SELECT email FROM users WHERE username=?`, username)

      res.locals.pagination = {
        params: req.urlParams,
        page: req.viewPage,
        pageCount:  Math.ceil(Object.values(totalFiles[0])[0] / req.viewLimit)
      }
      res.locals.view = {
        username: username,
        type: 'files'
      }
      res.locals.uploads = files.map(file => {
        file.public = !!file.public
        delete file.id
        return file
      })

      Object.assign(res.locals.og, {
        title: `${username}`,
        description: `A User Profile for ${res.locals.title}`,
        avatar: `https://www.gravatar.com/avatar/${md5(email.toLowerCase())}`,
        user: true
      })

      return req.viewJson
        ? res.json(res.locals.uploads)
        : res.render('user')
    }
    next()
  })
  .get('/:username/albums', (req, res, next) => {
    let username = req.params.username
    let showPrivate = req.isAuthenticated().username === username

    if (database().queryFirstCell(`SELECT username FROM users WHERE username=?`, username)) {
      let albums = showPrivate
        ? database().query(`SELECT id, album_id, title, public, (SELECT COUNT(id) FROM files WHERE in_album = albums.album_id) AS total_files
                            FROM albums WHERE uploaded_by=? ORDER BY id ${req.sortOrder} LIMIT ? OFFSET ?`, username, req.viewLimit, req.viewOffset)
        : database().query(`SELECT id, album_id, title, public, (SELECT COUNT(id) FROM files WHERE in_album = albums.album_id) AS total_files
                            FROM albums WHERE uploaded_by=? AND NOT public=0 ORDER BY id ${req.sortOrder} LIMIT ? OFFSET ?`, username, req.viewLimit, req.viewOffset)

      let totalAlbums = showPrivate
        ? database().query(`SELECT COUNT(id) FROM albums WHERE uploaded_by=?`, username)
        : database().query(`SELECT COUNT(id) FROM albums WHERE uploaded_by=? AND NOT public=0`, username)

      res.locals.pagination = {
        params: req.urlParams,
        page: req.viewPage,
        pageCount: Math.ceil(Object.values(totalAlbums[0])[0] / req.viewLimit)
      }
      res.locals.view = {
        username: username,
        type: 'albums'
      }
      res.locals.uploads = albums.map(album => {
        album.public = !!album.public
        album.album_title = album.title || "Untitled Album"
        delete album.title
        delete album.id
        return album
      })

      return req.viewJson
        ? res.json(res.locals)
        : res.render('user')
    }
    next()
  })
  .get('/:username/settings', (req, res, next) => res.render('debug', {
    title_fragment: 'user settings',
    route: `${req.baseUrl}${req.path}`
  }))

  // POST Method Routes
  .post('/:username/update', (req, res, next) => res.sendStatus(200))

  // Method Not Allowed
  .all('/:username', (req, res, next) => {
    if (req.method !== 'GET') return next(createError(405, {headers: { Allow: 'GET' }}))
    next()
  })
  .all('/:username/albums', (req, res, next) => {
    if (req.method !== 'GET') return next(createError(405, {headers: { Allow: 'GET' }}))
    next()
  })
  .all('/:username/settings', (req, res, next) => {
    if (req.method !== 'GET') return next(createError(405, {headers: { Allow: 'GET' }}))
    next()
  })
  .all('/:username/update', (req, res, next) => {
    if (req.method !== 'POST') return next(createError(405, {headers: { Allow: 'POST' }}))
    next()
  })
