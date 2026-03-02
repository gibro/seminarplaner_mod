<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\service;

use coding_exception;
use mod_konzeptgenerator\local\repository\lock_repository;

defined('MOODLE_INTERNAL') || die();

/**
 * Soft lock service for collaborative grid editing.
 */
class soft_lock_service {
    /** @var int */
    private const DEFAULT_TTL_SECONDS = 300;

    /** @var lock_repository */
    private $repository;

    /**
     * Constructor.
     *
     * @param lock_repository|null $repository Lock repository.
     */
    public function __construct(?lock_repository $repository = null) {
        $this->repository = $repository ?? new lock_repository();
    }

    /**
     * Try to acquire lock for user.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @param int $ttlseconds Lock ttl in seconds.
     * @return array{acquired: bool, token: string|null, holder: int|null, expiresat: int|null}
     */
    public function acquire(int $gridid, int $userid, int $ttlseconds = self::DEFAULT_TTL_SECONDS): array {
        if ($gridid <= 0 || $userid <= 0 || $ttlseconds < 30) {
            throw new coding_exception('Invalid lock acquire input');
        }

        $now = time();
        $this->repository->delete_expired_locks($now);

        $current = $this->repository->get_lock($gridid);
        if ($current && (int)$current->userid !== $userid) {
            return [
                'acquired' => false,
                'token' => null,
                'holder' => (int)$current->userid,
                'expiresat' => (int)$current->expiresat,
            ];
        }

        $token = bin2hex(random_bytes(16));
        $expiresat = $now + $ttlseconds;
        $this->repository->upsert_lock($gridid, $userid, $token, $expiresat);

        return [
            'acquired' => true,
            'token' => $token,
            'holder' => $userid,
            'expiresat' => $expiresat,
        ];
    }

    /**
     * Refresh lock if token and owner match.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @param string $token Lock token.
     * @param int $ttlseconds TTL extension.
     * @return bool
     */
    public function refresh(int $gridid, int $userid, string $token, int $ttlseconds = self::DEFAULT_TTL_SECONDS): bool {
        if ($gridid <= 0 || $userid <= 0 || $token === '') {
            throw new coding_exception('Invalid lock refresh input');
        }

        $current = $this->repository->get_lock($gridid);
        if (!$current) {
            return false;
        }

        if ((int)$current->userid !== $userid || (string)$current->locktoken !== $token) {
            return false;
        }

        $this->repository->upsert_lock($gridid, $userid, $token, time() + $ttlseconds);
        return true;
    }

    /**
     * Release lock if token and owner match.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @param string $token Lock token.
     * @return bool
     */
    public function release(int $gridid, int $userid, string $token): bool {
        if ($gridid <= 0 || $userid <= 0 || $token === '') {
            throw new coding_exception('Invalid lock release input');
        }

        $current = $this->repository->get_lock($gridid);
        if (!$current) {
            return false;
        }

        if ((int)$current->userid !== $userid || (string)$current->locktoken !== $token) {
            return false;
        }

        $this->repository->delete_lock($gridid);
        return true;
    }

    /**
     * Break lock regardless of owner.
     *
     * @param int $gridid Grid id.
     * @return void
     */
    public function break_lock(int $gridid): void {
        if ($gridid <= 0) {
            throw new coding_exception('Invalid grid id for break_lock');
        }

        $this->repository->delete_lock($gridid);
    }

    /**
     * Check current lock state.
     *
     * @param int $gridid Grid id.
     * @return array{locked: bool, holder: int|null, expiresat: int|null}
     */
    public function status(int $gridid): array {
        if ($gridid <= 0) {
            throw new coding_exception('Invalid grid id for status');
        }

        $this->repository->delete_expired_locks();
        $current = $this->repository->get_lock($gridid);
        if (!$current) {
            return ['locked' => false, 'holder' => null, 'expiresat' => null];
        }

        return [
            'locked' => true,
            'holder' => (int)$current->userid,
            'expiresat' => (int)$current->expiresat,
        ];
    }
}
